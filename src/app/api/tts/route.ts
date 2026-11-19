import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { checkRateLimit } from '@/lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 고음질 오디오 메모리 캐시 (동일 단어/문장 반복 재생 시 즉각 응답)
const ttsCache = new Map<string, { buffer: Buffer; voice: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const MAX_CACHE_ITEMS = 1000;

function escapeXmlForSsml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getEdgeNeuralVoices(lang: string, gender: 'female' | 'male'): string[] {
  if (lang.startsWith('en-GB')) {
    return gender === 'male'
      ? ['en-GB-RyanNeural', 'en-GB-ThomasNeural']
      : ['en-GB-SoniaNeural', 'en-GB-LibbyNeural'];
  }
  return gender === 'male'
    ? ['en-US-BrianMultilingualNeural', 'en-US-ChristopherNeural', 'en-US-GuyNeural']
    : ['en-US-AvaMultilingualNeural', 'en-US-AvaNeural', 'en-US-JennyNeural'];
}

async function synthesizeSingleEdgeVoice(text: string, voiceName: string): Promise<Buffer | null> {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 3500,
    synthesisTimeoutMs: 6000,
  });

  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const safeText = escapeXmlForSsml(text);
    const { audioStream } = tts.toStream(safeText);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        audioStream.destroy();
        reject(new Error(`Edge TTS stream timeout (${voiceName})`));
      }, 6500);

      audioStream.on('data', (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      audioStream.on('end', () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return buffer.length > 0 ? buffer : null;
  } catch (err) {
    console.warn(`Edge Neural TTS failed for ${voiceName}:`, err);
    return null;
  } finally {
    try {
      tts.close();
    } catch {}
  }
}

async function synthesizeEdgeNeuralTTS(
  text: string,
  lang: string,
  gender: 'female' | 'male'
): Promise<{ buffer: Buffer; voice: string } | null> {
  const voices = getEdgeNeuralVoices(lang, gender);
  for (const voiceName of voices) {
    const buffer = await synthesizeSingleEdgeVoice(text, voiceName);
    if (buffer && buffer.length > 0) {
      return { buffer, voice: voiceName };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 60);
    if (!rateLimit.allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSec) },
      });
    }

    const { searchParams } = new URL(req.url);
    const rawText = searchParams.get('text') || '';
    const lang = searchParams.get('lang') || 'en-US';
    const gender: 'female' | 'male' = searchParams.get('gender') === 'male' ? 'male' : 'female';
    const text = rawText.trim();

    if (!text || text.length > 600) {
      return new NextResponse('Text parameter is required (max 600 chars)', { status: 400 });
    }

    const cacheKey = `${lang}:${gender}:${text.toLowerCase()}`;
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
          'X-TTS-Source': 'cache',
          'X-TTS-Voice': cached.voice,
        },
      });
    }

    // 1. 단일 단어 + 여성 음성인 경우: 실제 인간 원어민 스튜디오 녹음 오디오(Dictionary API) 우선 탐색
    //    (Dictionary API 녹음은 대부분 여성 음성이므로, 남성 선택 시에는 일관된 남성 뉴럴 음성으로 합성)
    const isSingleWord = !text.includes(' ') && text.length < 35 && /^[a-zA-Z'-]+$/.test(text);
    if (isSingleWord && gender === 'female') {
      try {
        const dictRes = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text.toLowerCase())}`,
          { signal: AbortSignal.timeout(1200) }
        );
        if (dictRes.ok) {
          const dictData = await dictRes.json();
          if (Array.isArray(dictData) && dictData[0]?.phonetics) {
            const phonetics = dictData[0].phonetics;
            const isGb = lang.startsWith('en-GB');
            // 지역 악센트에 맞는 실제 인간 원어민 오디오 탐색
            const matchAudio =
              phonetics.find(
                (p: any) =>
                  p.audio &&
                  (isGb ? p.audio.includes('-uk.') || p.audio.includes('-gb.') : p.audio.includes('-us.'))
              ) || phonetics.find((p: any) => p.audio && p.audio.endsWith('.mp3'));

            if (matchAudio?.audio) {
              const audioRes = await fetch(matchAudio.audio, { signal: AbortSignal.timeout(1800) });
              if (audioRes.ok) {
                const arrayBuffer = await audioRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                if (ttsCache.size >= MAX_CACHE_ITEMS) {
                  const firstKey = ttsCache.keys().next().value;
                  if (firstKey) ttsCache.delete(firstKey);
                }
                ttsCache.set(cacheKey, { buffer, voice: 'dictionary-human', timestamp: Date.now() });

                return new NextResponse(new Uint8Array(buffer), {
                  headers: {
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
                    'X-TTS-Source': 'dictionary-human-recording',
                    'X-TTS-Voice': 'dictionary-human',
                  },
                });
              }
            }
          }
        }
      } catch {
        // Fallback to Edge Neural Voice
      }
    }

    // 2. 문장 및 단어 1순위: Microsoft Edge Neural TTS (자연스러운 원어민 오디오북 억양, 다중 백업 보이스 지원)
    const edgeResult = await synthesizeEdgeNeuralTTS(text, lang, gender);
    if (edgeResult && edgeResult.buffer.length > 0) {
      if (ttsCache.size >= MAX_CACHE_ITEMS) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, { buffer: edgeResult.buffer, voice: edgeResult.voice, timestamp: Date.now() });

      return new NextResponse(new Uint8Array(edgeResult.buffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
          'X-TTS-Source': 'edge-neural',
          'X-TTS-Voice': edgeResult.voice,
        },
      });
    }

    // 3. 비상 폴백: Google Translate TTS (Edge Neural 전체 장애 시에만 일시 사용, 캐시 금지!)
    const targetLang = lang.startsWith('en-GB') ? 'en-GB' : 'en-US';
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=gtx&q=${encodeURIComponent(
      text
    )}`;

    const res = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return new NextResponse('TTS audio fetch failed', { status: 502 });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-TTS-Source': 'google-fallback',
        'X-TTS-Voice': 'google-translate',
      },
    });
  } catch (err: any) {
    console.error('TTS Route error:', err);
    return new NextResponse('Internal TTS error', { status: 500 });
  }
}
