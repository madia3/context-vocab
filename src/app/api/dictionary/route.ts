import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const POS_MAP: Record<string, string> = {
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  preposition: '전치사',
  conjunction: '접속사',
  pronoun: '대명사',
  interjection: '감탄사',
  exclamation: '감탄사',
};

// In-memory cache for ultra-fast (0ms) repeat queries
const dictCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get('word') || '';
  const word = rawWord.trim().toLowerCase();

  if (!word) {
    return NextResponse.json({ error: 'Word parameter is required' }, { status: 400 });
  }

  // Check in-memory cache first
  const cached = dictCache.get(word);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Cache': 'HIT',
      },
    });
  }

  let phonetic = `/${word}/`;
  const meanings: { pos: string; def: string }[] = [];
  let fallbackPos = '명사';
  let exampleSentence = '';

  // Concurrent Execution: Fetch Google Translate (meanings & POS) AND Free Dictionary API (phonetics & examples) in PARALLEL!
  const googleTranslatePromise = (async () => {
    try {
      const gRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(2500),
          next: { revalidate: 86400 },
        }
      );

      if (gRes.ok) {
        return await gRes.json();
      }
    } catch (err) {
      console.warn('Google translate quick fetch error:', err);
    }
    return null;
  })();

  const phoneticsPromise = (async () => {
    try {
      // Set short 1.2s timeout so slow/unresponsive foreign dictionary API never blocks response!
      const pRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
        signal: AbortSignal.timeout(1200),
        next: { revalidate: 86400 },
      });
      if (pRes.ok) {
        return await pRes.json();
      }
    } catch (err) {
      // Gracefully ignore timeout or network issue
    }
    return null;
  })();

  // Run both requests concurrently
  const [gData, pData] = await Promise.all([googleTranslatePromise, phoneticsPromise]);

  // 1. Process Phonetics & Example Sentence (if available)
  if (pData && Array.isArray(pData) && pData.length > 0) {
    if (pData[0]?.phonetic) {
      phonetic = pData[0].phonetic;
    } else if (pData[0]?.phonetics?.[0]?.text) {
      phonetic = pData[0].phonetics[0].text;
    }
    if (pData[0]?.meanings?.[0]?.partOfSpeech) {
      const pEn = pData[0].meanings[0].partOfSpeech.toLowerCase();
      fallbackPos = POS_MAP[pEn] || pEn;
    }

    for (const entry of pData) {
      if (entry.meanings && Array.isArray(entry.meanings)) {
        for (const m of entry.meanings) {
          if (m.definitions && Array.isArray(m.definitions)) {
            for (const def of m.definitions) {
              if (def.example && typeof def.example === 'string' && def.example.trim()) {
                const ex = def.example.trim();
                if (ex.toLowerCase().includes(word)) {
                  exampleSentence = ex;
                  break;
                } else if (!exampleSentence) {
                  exampleSentence = ex;
                }
              }
            }
          }
          if (exampleSentence && exampleSentence.toLowerCase().includes(word)) break;
        }
      }
      if (exampleSentence && exampleSentence.toLowerCase().includes(word)) break;
    }
  }

  // 2. Process Google Translate Results
  if (gData) {
    // gData[1] contains part of speech and detailed definitions
    if (gData[1] && Array.isArray(gData[1])) {
      gData[1].forEach((entry: any) => {
        const posEn = String(entry[0] || '').toLowerCase();
        const posKo = POS_MAP[posEn] || posEn || '품사';
        const defs = entry[1] || [];

        const seen = new Set<string>();
        defs.forEach((d: string) => {
          const trimmed = String(d || '').trim();
          if (trimmed && !seen.has(trimmed) && seen.size < 4) {
            seen.add(trimmed);
            meanings.push({
              pos: posKo,
              def: trimmed,
            });
          }
        });
      });
    }

    // Fallback: If gData[1] is empty, use main translation from gData[0]
    if (meanings.length === 0 && gData[0]?.[0]?.[0]) {
      meanings.push({
        pos: fallbackPos,
        def: String(gData[0][0][0]).trim(),
      });
    }
  }

  // 3. Fallback: If still empty, fast attempt with MyMemory API
  if (meanings.length === 0) {
    try {
      const mRes = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`,
        { signal: AbortSignal.timeout(1800) }
      );
      if (mRes.ok) {
        const mData = await mRes.json();
        if (mData.responseData?.translatedText) {
          meanings.push({ pos: fallbackPos, def: mData.responseData.translatedText });
        }
        if (mData.matches) {
          mData.matches.slice(0, 3).forEach((m: any) => {
            if (m.translation && !meanings.some((x) => x.def === m.translation)) {
              meanings.push({ pos: fallbackPos, def: m.translation });
            }
          });
        }
      }
    } catch (mErr) {
      console.warn('MyMemory fallback error:', mErr);
    }
  }

  // Fallback sentence template if no example found
  if (!exampleSentence) {
    if (fallbackPos === '동사') {
      exampleSentence = `She ${word} to the station early this morning.`;
    } else if (fallbackPos === '형용사') {
      exampleSentence = `This is a very ${word} approach to the problem.`;
    } else {
      exampleSentence = `Here is a sample sentence illustrating the word "${word}".`;
    }
  }

  const result = meanings.length > 0
    ? {
        word,
        phonetic,
        meanings,
        exampleSentence,
        sourceName: '표준 영한 사전',
      }
    : {
        word,
        phonetic,
        meanings: [{ pos: '직접입력', def: '한국어 뜻을 직접 입력해 주세요.' }],
        exampleSentence,
        sourceName: '수동 입력 모드',
      };

  // Cache in server memory
  dictCache.set(word, { data: result, timestamp: Date.now() });

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
