import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 고음질 오디오 메모리 캐시 (동일 단어/문장 반복 재생 시 즉각 응답)
const ttsCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const MAX_CACHE_ITEMS = 1000;

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
    const text = rawText.trim();

    if (!text || text.length > 600) {
      return new NextResponse('Text parameter is required (max 600 chars)', { status: 400 });
    }

    const cacheKey = `${lang}:${text.toLowerCase()}`;
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
          'X-TTS-Source': 'cache',
        },
      });
    }

    // 1. 단일 단어인 경우: 실제 인간 원어민 스튜디오 녹음 오디오(Dictionary API) 우선 탐색
    const isSingleWord = !text.includes(' ') && text.length < 35 && /^[a-zA-Z'-]+$/.test(text);
    if (isSingleWord) {
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
                ttsCache.set(cacheKey, { buffer, timestamp: Date.now() });

                return new NextResponse(new Uint8Array(buffer), {
                  headers: {
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
                    'X-TTS-Source': 'dictionary-human-recording',
                  },
                });
              }
            }
          }
        }
      } catch {
        // Fallback to Google Neural Voice
      }
    }

    // 2. 문장 및 복합 단어: 고품질 원어민 뉴럴 오디오 스트림 (Google Neural Voice)
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

    if (ttsCache.size >= MAX_CACHE_ITEMS) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, { buffer, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
        'X-TTS-Source': 'google-neural',
      },
    });
  } catch (err: any) {
    console.error('TTS Route error:', err);
    return new NextResponse('Internal TTS error', { status: 500 });
  }
}
