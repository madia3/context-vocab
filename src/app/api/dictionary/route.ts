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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get('word') || '';
  const word = rawWord.trim().toLowerCase();

  if (!word) {
    return NextResponse.json({ error: 'Word parameter is required' }, { status: 400 });
  }

  let phonetic = `/${word}/`;
  const meanings: { pos: string; def: string }[] = [];

  // 1. 발음기호 및 영어 사전 품사, 기본 예문 탐색 (Free Dictionary API)
  let fallbackPos = '명사';
  let exampleSentence = '';
  try {
    const pRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      next: { revalidate: 86400 },
    });
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData[0]?.phonetic) {
        phonetic = pData[0].phonetic;
      } else if (pData[0]?.phonetics?.[0]?.text) {
        phonetic = pData[0].phonetics[0].text;
      }
      if (pData[0]?.meanings?.[0]?.partOfSpeech) {
        const pEn = pData[0].meanings[0].partOfSpeech.toLowerCase();
        fallbackPos = POS_MAP[pEn] || pEn;
      }

      // 단어가 포함된 실제 예문(Example sentence) 탐색
      if (Array.isArray(pData)) {
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
    }
  } catch (e) {
    console.warn('Phonetics & Example fetch warning:', e);
  }

  // 예문이 없으면 품사에 맞는 자연스러운 기본 예문 템플릿 제공
  if (!exampleSentence) {
    if (fallbackPos === '동사') {
      exampleSentence = `She ${word} to the station early this morning.`;
    } else if (fallbackPos === '형용사') {
      exampleSentence = `This is a very ${word} approach to the problem.`;
    } else {
      exampleSentence = `Here is a sample sentence illustrating the word "${word}".`;
    }
  }

  // 2. Google Translate GTX API 호출 (서버 사이드 호출이므로 CORS 없음)
  try {
    const gRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        next: { revalidate: 86400 },
      }
    );

    if (gRes.ok) {
      const gData = await gRes.json();

      // gData[1]은 품사별 상세 뜻 배열: [ ["noun", ["쇠퇴", "감퇴", ...]], ["verb", ["떨어지다", "거절하다", ...]] ]
      if (gData[1] && Array.isArray(gData[1])) {
        gData[1].forEach((entry: any) => {
          const posEn = String(entry[0] || '').toLowerCase();
          const posKo = POS_MAP[posEn] || posEn || '품사';
          const defs = entry[1] || [];

          // 품사별로 중복 없이 최대 4개의 대표 뜻 추출
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

      // 만약 품사별 상세(gData[1])가 비어있고 대표 번역(gData[0])만 있는 경우
      if (meanings.length === 0 && gData[0]?.[0]?.[0]) {
        meanings.push({
          pos: fallbackPos,
          def: String(gData[0][0][0]).trim(),
        });
      }
    }
  } catch (err) {
    console.warn('Server-side Google Translate error:', err);
  }

  // 3. 만약 여전히 비어있다면 MyMemory API Fallback (품사 매핑 보완)
  if (meanings.length === 0) {
    try {
      const mRes = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`
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

  // 4. 최종 결과 반환
  if (meanings.length > 0) {
    return NextResponse.json({
      word,
      phonetic,
      meanings,
      exampleSentence,
      sourceName: '표준 영한 사전',
    });
  }

  return NextResponse.json(
    {
      word,
      phonetic,
      meanings: [{ pos: '직접입력', def: '한국어 뜻을 직접 입력해 주세요.' }],
      exampleSentence,
      sourceName: '수동 입력 모드',
    },
    { status: 200 }
  );
}
