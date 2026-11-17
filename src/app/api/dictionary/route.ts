import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/geminiServer';

export const runtime = 'nodejs';

const POS_MAP: Record<string, string> = {
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  preposition: '전치사',
  conjunction: '접속사',
  pronoun: '대명사',
  determiner: '한정사',
  interjection: '감탄사',
  exclamation: '감탄사',
};

// 필수 기초 핵심 어휘 내장 사전 (0ms 초고속 & 정확한 한국어 뜻 + 자연스러운 예문 보장)
const BUILTIN_CORE_DICT: Record<
  string,
  {
    phonetic: string;
    meanings: { pos: string; def: string }[];
    exampleSentence: string;
  }
> = {
  this: {
    phonetic: '/ðɪs/',
    meanings: [
      { pos: '대명사', def: '이것, 이 사람' },
      { pos: '형용사', def: '이, 이번의' },
      { pos: '부사', def: '이렇게, 이만큼' },
    ],
    exampleSentence: 'This is what I have been looking for.',
  },
  that: {
    phonetic: '/ðæt/',
    meanings: [
      { pos: '대명사', def: '그것, 저것' },
      { pos: '형용사', def: '그, 저' },
      { pos: '접속사', def: '~라는 점, ~하도록' },
    ],
    exampleSentence: 'That is completely true.',
  },
  these: {
    phonetic: '/ðiːz/',
    meanings: [
      { pos: '대명사', def: '이것들, 이 사람들' },
      { pos: '형용사', def: '이, 이들의' },
    ],
    exampleSentence: 'These are the main factors to consider.',
  },
  those: {
    phonetic: '/ðoʊz/',
    meanings: [
      { pos: '대명사', def: '저것들, 그것들' },
      { pos: '형용사', def: '저, 그' },
    ],
    exampleSentence: 'Those who work hard will succeed.',
  },
  it: {
    phonetic: '/ɪt/',
    meanings: [
      { pos: '대명사', def: '그것, 그것은' },
      { pos: '대명사', def: '날씨/시간/거리 등의 비인칭 주어' },
    ],
    exampleSentence: 'It is important to review the facts.',
  },
  what: {
    phonetic: '/wɑːt/',
    meanings: [
      { pos: '대명사', def: '무엇, 무슨 일' },
      { pos: '형용사', def: '어떤, 무슨' },
      { pos: '관계대명사', def: '~하는 것' },
    ],
    exampleSentence: 'What do you think about this plan?',
  },
  which: {
    phonetic: '/wɪtʃ/',
    meanings: [
      { pos: '대명사', def: '어느 것, 어떤 쪽' },
      { pos: '형용사', def: '어느, 어떤' },
      { pos: '관계대명사', def: '그리고 그것은' },
    ],
    exampleSentence: 'Which option do you prefer?',
  },
  who: {
    phonetic: '/huː/',
    meanings: [
      { pos: '대명사', def: '누구, 어떤 사람' },
      { pos: '관계대명사', def: '~하는 사람' },
    ],
    exampleSentence: 'Who is responsible for this project?',
  },
  where: {
    phonetic: '/wer/',
    meanings: [
      { pos: '부사', def: '어디에, 어디서' },
      { pos: '관계부사', def: '~하는 곳' },
    ],
    exampleSentence: 'Where can we find more information?',
  },
  when: {
    phonetic: '/wen/',
    meanings: [
      { pos: '부사', def: '언제' },
      { pos: '접속사', def: '~할 때' },
    ],
    exampleSentence: 'When the meeting ended, everyone agreed.',
  },
  why: {
    phonetic: '/waɪ/',
    meanings: [
      { pos: '부사', def: '왜, 어째서' },
      { pos: '명사', def: '이유, 까닭' },
    ],
    exampleSentence: 'Why did the results change so quickly?',
  },
  how: {
    phonetic: '/haʊ/',
    meanings: [
      { pos: '부사', def: '어떻게, 어떠한 방식으로' },
      { pos: '부사', def: '얼마나, 어느 정도로' },
    ],
    exampleSentence: 'How can we improve this process?',
  },
  there: {
    phonetic: '/ðer/',
    meanings: [
      { pos: '부사', def: '그곳에, 저기에' },
      { pos: '대명사', def: '~이 있다 (there is/are)' },
    ],
    exampleSentence: 'There are several ways to solve this.',
  },
  here: {
    phonetic: '/hɪr/',
    meanings: [
      { pos: '부사', def: '여기에, 이곳으로' },
      { pos: '감탄사', def: '자, 여기' },
    ],
    exampleSentence: 'Here is the summary of the report.',
  },
  nominal: {
    phonetic: '/ˈnɒm.ɪ.nəl/',
    meanings: [
      { pos: '형용사', def: '명목상의, 액면의 (실질 대비)' },
      { pos: '형용사', def: '아주 적은, 상징적인 (명목뿐인)' },
      { pos: '형용사', def: '이름만의, 명의상의' },
    ],
    exampleSentence: 'Our analysts expect nominal global AI investment to rise next year.',
  },
  category: {
    phonetic: '/ˈkæt.ə.ɡri/',
    meanings: [
      { pos: '명사', def: '범주, 카테고리, 부문' },
      { pos: '명사', def: '분류, 종류, 계층' },
    ],
    exampleSentence: 'The products are divided into three main categories.',
  },
  demographic: {
    phonetic: '/ˌdem.əˈɡræf.ɪk/',
    meanings: [
      { pos: '명사', def: '인구 통계학적 집단 (연령·소득·성별 등 고객층)' },
      { pos: '형용사', def: '인구 통계학의, 인구학적인' },
    ],
    exampleSentence: 'It may help to fit your ideal customers into traditional demographics.',
  },
  demographics: {
    phonetic: '/ˌdem.əˈɡræf.ɪks/',
    meanings: [
      { pos: '명사', def: '인구 통계, 고객층 특성 (연령·성별·소득 등)' },
      { pos: '명사', def: '인구 동태 데이터' },
    ],
    exampleSentence: 'It may help to fit your ideal customers into traditional demographics.',
  },
  opportunity: {
    phonetic: '/ˌɒp.əˈtjuː.nə.ti/',
    meanings: [
      { pos: '명사', def: '기회, 호기' },
      { pos: '명사', def: '가능성, 여지' },
    ],
    exampleSentence: 'Business opportunities are like buses; there is always another one coming.',
  },
  frequent: {
    phonetic: '/ˈfriː.kwənt/',
    meanings: [
      { pos: '형용사', def: '빈번한, 잦은, 흔한' },
      { pos: '동사', def: '(장소에) 자주 가다, 상시 출입하다' },
    ],
    exampleSentence: 'Frequent references to customers lead to an important question.',
  },
  reference: {
    phonetic: '/ˈref.ər.əns/',
    meanings: [
      { pos: '명사', def: '언급, 지칭, 참조' },
      { pos: '명사', def: '참고 문헌, 추천서' },
      { pos: '동사', def: '참고하다, 인용하다' },
    ],
    exampleSentence: 'The article makes several references to recent economic trends.',
  },
  forecast: {
    phonetic: '/ˈfɔː.kɑːst/',
    meanings: [
      { pos: '명사', def: '예측, 전망, 예보' },
      { pos: '동사', def: '예측하다, 전망하다' },
    ],
    exampleSentence: 'The risks to the economic forecast are tilted to the downside.',
  },
  deficit: {
    phonetic: '/ˈdef.ɪ.sɪt/',
    meanings: [
      { pos: '명사', def: '적자, 부족액, 결손' },
      { pos: '명사', def: '결핍, 부족' },
    ],
    exampleSentence: 'Fiscal deficits could result in slower global GDP growth.',
  },
  fiscal: {
    phonetic: '/ˈfɪs.kəl/',
    meanings: [
      { pos: '형용사', def: '재정의, 국가 재정상의, 회계의' },
    ],
    exampleSentence: 'The government announced new fiscal policies to reduce the deficit.',
  },
  capex: {
    phonetic: '/ˈkæp.eks/',
    meanings: [
      { pos: '명사', def: '자본적 지출, 설비 투자 (Capital Expenditure)' },
    ],
    exampleSentence: 'Lower-than-expected AI capex could result in slower growth.',
  },
  downside: {
    phonetic: '/ˈdaʊn.saɪd/',
    meanings: [
      { pos: '명사', def: '하방 위험, 하락 가능성, 단점' },
      { pos: '형용사', def: '하락세의, 불리한 면의' },
    ],
    exampleSentence: 'The risks to the forecast are tilted to the downside.',
  },
   tilt: {
    phonetic: '/tɪlt/',
    meanings: [
      { pos: '동사', def: '기울다, 기울이다, 편향되다' },
      { pos: '명사', def: '기울기, 경사, 편향' },
    ],
    exampleSentence: 'The balance of risks is tilted toward the downside.',
  },
  complete: {
    phonetic: '/kəmˈpliːt/',
    meanings: [
      { pos: '형용사', def: '완전한, 완벽한' },
      { pos: '형용사', def: '완성된, 끝난' },
      { pos: '동사', def: '완료하다, 끝마치다' },
      { pos: '동사', def: '완성하다, 작성하다' },
    ],
    exampleSentence: 'He completed the project on time.',
  },
  completed: {
    phonetic: '/kəmˈpliːtɪd/',
    meanings: [
      { pos: '형용사', def: '완료된, 완성된' },
      { pos: '동사', def: '완료했다, 끝마쳤다' },
    ],
    exampleSentence: 'The task is successfully completed.',
  },
  completely: {
    phonetic: '/kəmˈpliːtli/',
    meanings: [
      { pos: '부사', def: '완전히, 전적으로' },
      { pos: '부사', def: '완벽하게, 온전히' },
    ],
    exampleSentence: 'I completely agree with your proposal.',
  },
  completion: {
    phonetic: '/kəmˈpliː.ʃən/',
    meanings: [
      { pos: '명사', def: '완료, 완성, 완공' },
      { pos: '명사', def: '성취, 체결' },
    ],
    exampleSentence: 'The project is nearing completion.',
  },
  incomplete: {
    phonetic: '/ˌɪn.kəmˈpliːt/',
    meanings: [
      { pos: '형용사', def: '불완전한, 미완성의' },
      { pos: '형용사', def: '미결의, 부족한' },
    ],
    exampleSentence: 'The report was incomplete and needed more data.',
  },
  mean: {
    phonetic: '/miːn/',
    meanings: [
      { pos: '동사', def: '의미하다, 뜻하다' },
      { pos: '동사', def: '~을 의도하다, 작정하다' },
      { pos: '형용사', def: '못된, 심술궂은' },
      { pos: '명사', def: '평균, 중용' },
    ],
    exampleSentence: 'What do you mean by that?',
  },
  meaning: {
    phonetic: '/ˈmiː.nɪŋ/',
    meanings: [
      { pos: '명사', def: '의미, 뜻' },
      { pos: '명사', def: '중요성, 취지' },
    ],
    exampleSentence: 'The word has several different meanings.',
  },
  means: {
    phonetic: '/miːnz/',
    meanings: [
      { pos: '명사', def: '수단, 방법' },
      { pos: '명사', def: '재산, 재력' },
      { pos: '동사', def: '의미하다 (mean의 3인칭 단수)' },
    ],
    exampleSentence: 'We must find a means to achieve this goal.',
  },
  selfemployed: {
    phonetic: '/ˌself.ɪmˈplɔɪd/',
    meanings: [
      { pos: '형용사', def: '자영업의, 개인 사업의' },
      { pos: '형용사', def: '프리랜서의' },
    ],
    exampleSentence: 'Many professionals choose to be self-employed.',
  },
  'self-employed': {
    phonetic: '/ˌself.ɪmˈplɔɪd/',
    meanings: [
      { pos: '형용사', def: '자영업의, 개인 사업의' },
      { pos: '형용사', def: '프리랜서의' },
    ],
    exampleSentence: 'Many professionals choose to be self-employed.',
  },
};

// 한국어 번역 뜻 정제 및 노이즈 필터링 함수
const BANNED_DEFINITIONS = new Set(['성업', '번역', 'matecat', 'mymemory', 'undefined', 'null']);

function isValidKoreanDefinition(def: string): boolean {
  if (!def || typeof def !== 'string') return false;
  const trimmed = def.trim();

  // 크라우드소싱 오역 및 시스템 노이즈 배제
  if (BANNED_DEFINITIONS.has(trimmed.toLowerCase())) return false;

  // 비어있거나 너무 길면 배제 (뜻은 간결해야 함)
  if (trimmed.length === 0 || trimmed.length > 25) return false;

  // 시스템 메타데이터 및 HTML/툴팁 태그 배제
  if (/@|tooltip|info:|http|www\.|\.com|\[|\]|<|>|\{|\}/i.test(trimmed)) return false;

  // 영문자가 절반 이상 포함된 경우 배제 (번역 미완성 또는 노이즈)
  const englishCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (englishCount > trimmed.length * 0.4) return false;

  // 번역 메모리의 문장형 번역(예: '연필입니다', '그것은 사과이다') 배제
  if (/(입니다|합니다|습니다|한다|했다|이다|된다)$/.test(trimmed) && trimmed.length > 3) {
    return false;
  }

  return true;
}

// In-memory cache for ultra-fast (0ms) repeat queries
const dictCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const MAX_CACHE_ENTRIES = 2000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get('word') || '';
  const word = rawWord.trim().toLowerCase().replace(/[^a-z'-]/g, '');

  if (!word || word.length > 60) {
    return NextResponse.json({ error: 'Valid word parameter is required' }, { status: 400 });
  }

  // 1. 필수 기초 어휘 내장 사전 우선 확인 (0ms 즉시 반환)
  if (BUILTIN_CORE_DICT[word]) {
    const builtin = BUILTIN_CORE_DICT[word];
    return NextResponse.json({
      word,
      phonetic: builtin.phonetic,
      meanings: builtin.meanings,
      exampleSentence: builtin.exampleSentence,
      sourceName: '표준 영한 사전 (핵심 어휘)',
    });
  }

  // 2. Check in-memory cache
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

  // Concurrent Execution: Fetch Google Translate AND Free Dictionary API in PARALLEL
  const googleTranslatePromise = (async () => {
    try {
      const gRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(3000),
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
      const pRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
        signal: AbortSignal.timeout(2500),
        next: { revalidate: 86400 },
      });
      if (pRes.ok) {
        return await pRes.json();
      }
    } catch (err) {
      // Gracefully ignore timeout
    }
    return null;
  })();

  const [gData, pData] = await Promise.all([googleTranslatePromise, phoneticsPromise]);

  // 1. Process Phonetics & Natural Example Sentence from English Dictionary API
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

  // 2. Process Google Translate Results with strict sanitization
  if (gData) {
    if (gData[1] && Array.isArray(gData[1])) {
      gData[1].forEach((entry: any) => {
        const posEn = String(entry[0] || '').toLowerCase();
        const posKo = POS_MAP[posEn] || posEn || '품사';
        const defs = entry[1] || [];

        const seen = new Set<string>();
        defs.forEach((d: string) => {
          const trimmed = String(d || '').trim();
          if (isValidKoreanDefinition(trimmed) && !seen.has(trimmed) && seen.size < 4) {
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
      const mainDef = String(gData[0][0][0]).trim();
      if (isValidKoreanDefinition(mainDef)) {
        meanings.push({
          pos: fallbackPos,
          def: mainDef,
        });
      }
    }
  }

  // 3. High-Accuracy AI Lexicographer Fallback via Gemini (표준 영한 사전 수준의 품사별 뜻 & 예문)
  if (meanings.length === 0) {
    const clientKey = request.headers.get('x-gemini-key');
    const geminiKey = clientKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const aiPrompt = `You are a standard English-Korean dictionary (like Naver/Daum English Dictionary).
Word: "${word}"
Provide standard, accurate Korean dictionary definitions.
Categorize by standard Korean parts of speech (형용사, 동사, 명사, 부사, etc.).
Exclude obscure, archaic, or crowd-sourced mistranslations (e.g. NEVER translate "complete" as "성업").
Return strictly valid JSON:
{
  "phonetic": "/.../",
  "meanings": [
    { "pos": "형용사", "def": "완전한, 완벽한" }
  ],
  "exampleSentence": "..."
}`;
        const aiRes = await callGeminiWithFallback({
          apiKey: geminiKey,
          parts: [{ text: aiPrompt }],
          responseMimeType: 'application/json',
          temperature: 0.0,
          candidates: [
            { model: 'gemini-3.1-flash-lite', thinkingConfig: { thinkingBudget: 0 }, timeoutMs: 2500 },
            { model: 'gemini-3.5-flash-lite', thinkingConfig: { thinkingLevel: 'LOW' }, timeoutMs: 3000 },
          ],
        });

        if (aiRes.ok && aiRes.text) {
          const cleanJson = aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed.phonetic && typeof parsed.phonetic === 'string' && parsed.phonetic.trim()) {
            phonetic = parsed.phonetic.trim();
          }
          if (Array.isArray(parsed.meanings) && parsed.meanings.length > 0) {
            parsed.meanings.forEach((m: any) => {
              const def = String(m.def || '').trim();
              const pos = String(m.pos || fallbackPos).trim();
              if (def && isValidKoreanDefinition(def) && meanings.length < 5) {
                meanings.push({ pos, def });
              }
            });
          }
          if (parsed.exampleSentence && typeof parsed.exampleSentence === 'string' && parsed.exampleSentence.trim()) {
            exampleSentence = parsed.exampleSentence.trim();
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini dictionary fallback error:', geminiErr);
      }
    }
  }

  // 4. Secondary Fallback with MyMemory API (엄격 필터링 적용 - 툴팁/문장 노이즈 차단)
  if (meanings.length === 0) {
    try {
      const mRes = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`,
        { signal: AbortSignal.timeout(1800) }
      );
      if (mRes.ok) {
        const mData = await mRes.json();
        const seenDefs = new Set<string>();

        if (mData.responseData?.translatedText) {
          const t = String(mData.responseData.translatedText).trim();
          if (isValidKoreanDefinition(t)) {
            seenDefs.add(t);
            meanings.push({ pos: fallbackPos, def: t });
          }
        }
        if (mData.matches && Array.isArray(mData.matches)) {
          mData.matches.forEach((m: any) => {
            const quality = Number(m.quality || 0);
            const translation = String(m.translation || '').trim();
            // 품질 점수 70 이상 & 노이즈 필터 통과한 항목만 수용
            if (quality >= 70 && isValidKoreanDefinition(translation) && !seenDefs.has(translation) && meanings.length < 4) {
              seenDefs.add(translation);
              meanings.push({ pos: fallbackPos, def: translation });
            }
          });
        }
      }
    } catch (mErr) {
      console.warn('MyMemory fallback error:', mErr);
    }
  }

  // 자연스러운 실생활 예문 템플릿 (어색한 더미 문장 완전 배제)
  if (!exampleSentence) {
    if (fallbackPos === '동사') {
      exampleSentence = `They decided to ${word} the project together.`;
    } else if (fallbackPos === '형용사') {
      exampleSentence = `It was a very ${word} experience for all of us.`;
    } else if (fallbackPos === '부사') {
      exampleSentence = `She spoke ${word} during the presentation.`;
    } else if (fallbackPos === '대명사') {
      exampleSentence = `${word.charAt(0).toUpperCase() + word.slice(1)} is the most important part of the story.`;
    } else {
      exampleSentence = `She learned how to use the word "${word}" in context.`;
    }
  }

  const result =
    meanings.length > 0
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
          meanings: [],
          exampleSentence,
          sourceName: '수동 입력 모드',
        };

  // Only cache positive results in server memory
  if (result.meanings.length > 0) {
    if (dictCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = dictCache.keys().next().value;
      if (oldestKey) dictCache.delete(oldestKey);
    }
    dictCache.set(word, { data: result, timestamp: Date.now() });
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
