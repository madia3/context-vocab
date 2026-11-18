import { DictSearchResult, MeaningOption } from '@/types/vocab';
import { speakNatural, preloadNaturalAudioTTS } from './tts';

export const BUILTIN_KOREAN_DICT: Record<string, { phonetic: string; meanings: MeaningOption[] }> = {
  tragedy: {
    phonetic: "/ˈtrædʒ.ə.di/",
    meanings: [
      { pos: "명사", def: "비극, 비극적인 사건" },
      { pos: "명사", def: "참사, 재난" },
      { pos: "명사", def: "(문학) 비극 작품" },
    ],
  },
  prevalent: {
    phonetic: "/ˈprev.əl.ənt/",
    meanings: [
      { pos: "형용사", def: "널리 퍼진, 유행하는" },
      { pos: "형용사", def: "우세한, 지배적인" },
    ],
  },
  ubiquitous: {
    phonetic: "/juːˈbɪk.wə.təs/",
    meanings: [
      { pos: "형용사", def: "어디에나 있는, 아주 흔한" },
      { pos: "형용사", def: "도처에 존재하는" },
    ],
  },
  mitigate: {
    phonetic: "/ˈmɪt.ɪ.ɡeɪt/",
    meanings: [
      { pos: "동사", def: "완화하다, 경감시키다" },
      { pos: "동사", def: "누그러뜨리다, 진정시키다" },
    ],
  },
  pragmatic: {
    phonetic: "/præɡˈmæt.ɪk/",
    meanings: [
      { pos: "형용사", def: "실용적인, 실무적인" },
      { pos: "형용사", def: "현실주의적인" },
    ],
  },
  lucid: {
    phonetic: "/ˈluː.sɪd/",
    meanings: [
      { pos: "형용사", def: "명쾌한, 이해하기 쉬운" },
      { pos: "형용사", def: "의식이 또렷한, 맑은" },
    ],
  },
  ambiguous: {
    phonetic: "/æmˈbɪɡ.ju.əs/",
    meanings: [
      { pos: "형용사", def: "애매모호한, 두 가지 이상으로 해석되는" },
      { pos: "형용사", def: "분명하지 않은" },
    ],
  },
  resilient: {
    phonetic: "/rɪˈzɪl.jənt/",
    meanings: [
      { pos: "형용사", def: "회복력 있는, 탄력 있는" },
      { pos: "형용사", def: "곧 기운을 차리는" },
    ],
  },
  scrutinize: {
    phonetic: "/ˈskruː.tɪ.naɪz/",
    meanings: [{ pos: "동사", def: "세심하게 살피다, 면밀히 조사하다" }],
  },
  tenacious: {
    phonetic: "/təˈneɪ.ʃəs/",
    meanings: [{ pos: "형용사", def: "끈기 있는, 완강한, 집요한" }],
  },
  complacent: {
    phonetic: "/kəmˈpleɪ.sənt/",
    meanings: [{ pos: "형용사", def: "자기만족에 빠진, 안주하는" }],
  },
  ephemeral: {
    phonetic: "/ɪˈfem.ər.əl/",
    meanings: [{ pos: "형용사", def: "수명이 짧은, 덧없는, 순식간의" }],
  },
  prolific: {
    phonetic: "/prəˈlɪf.ɪk/",
    meanings: [{ pos: "형용사", def: "다작하는, 풍부한, 다산의" }],
  },
  meticulous: {
    phonetic: "/məˈtɪk.jə.ləs/",
    meanings: [{ pos: "형용사", def: "꼼꼼한, 세심한, 빈틈없는" }],
  },
  paradigm: {
    phonetic: "/ˈpær.ə.daɪm/",
    meanings: [{ pos: "명사", def: "패러다임, 전형적인 예, 인식의 틀" }],
  },
  complete: {
    phonetic: "/kəmˈpliːt/",
    meanings: [
      { pos: "형용사", def: "완전한, 완벽한" },
      { pos: "형용사", def: "완성된, 끝난" },
      { pos: "동사", def: "완료하다, 끝마치다" },
      { pos: "동사", def: "완성하다, 작성하다" },
    ],
  },
  completed: {
    phonetic: "/kəmˈpliːtɪd/",
    meanings: [
      { pos: "형용사", def: "완료된, 완성된" },
      { pos: "동사", def: "완료했다, 끝마쳤다" },
    ],
  },
  completely: {
    phonetic: "/kəmˈpliːtli/",
    meanings: [
      { pos: "부사", def: "완전히, 전적으로" },
      { pos: "부사", def: "완벽하게, 온전히" },
    ],
  },
  completion: {
    phonetic: "/kəmˈpliː.ʃən/",
    meanings: [
      { pos: "명사", def: "완료, 완성, 완공" },
      { pos: "명사", def: "성취, 체결" },
    ],
  },
  incomplete: {
    phonetic: "/ˌɪn.kəmˈpliːt/",
    meanings: [
      { pos: "형용사", def: "불완전한, 미완성의" },
      { pos: "형용사", def: "미결의, 부족한" },
    ],
  },
  mean: {
    phonetic: "/miːn/",
    meanings: [
      { pos: "동사", def: "의미하다, 뜻하다" },
      { pos: "동사", def: "~을 의도하다, 작정하다" },
      { pos: "형용사", def: "못된, 심술궂은" },
      { pos: "명사", def: "평균, 중용" },
    ],
  },
  meaning: {
    phonetic: "/ˈmiː.nɪŋ/",
    meanings: [
      { pos: "명사", def: "의미, 뜻" },
      { pos: "명사", def: "중요성, 취지" },
    ],
  },
  means: {
    phonetic: "/miːnz/",
    meanings: [
      { pos: "명사", def: "수단, 방법" },
      { pos: "명사", def: "재산, 재력" },
      { pos: "동사", def: "의미하다 (mean의 3인칭 단수)" },
    ],
  },
  selfemployed: {
    phonetic: "/ˌself.ɪmˈplɔɪd/",
    meanings: [
      { pos: "형용사", def: "자영업의, 개인 사업의" },
      { pos: "형용사", def: "프리랜서의" },
    ],
  },
  "self-employed": {
    phonetic: "/ˌself.ɪmˈplɔɪd/",
    meanings: [
      { pos: "형용사", def: "자영업의, 개인 사업의" },
      { pos: "형용사", def: "프리랜서의" },
    ],
  },
  perspective: {
    phonetic: "/pərˈspek.tɪv/",
    meanings: [
      { pos: "명사", def: "관점, 시각" },
      { pos: "명사", def: "원근법" },
      { pos: "명사", def: "균형 잡힌 시각, 균형감" },
      { pos: "형용사", def: "원근법의, 투시화법의" },
    ],
  },
  perspectives: {
    phonetic: "/pərˈspek.tɪvz/",
    meanings: [
      { pos: "명사", def: "관점, 시각" },
      { pos: "명사", def: "원근법" },
    ],
  },
  banking: {
    phonetic: "/ˈbæŋ.kɪŋ/",
    meanings: [
      { pos: "명사", def: "은행업, 은행 업무, 금융업" },
    ],
  },
  lending: {
    phonetic: "/ˈlen.dɪŋ/",
    meanings: [
      { pos: "명사", def: "대출, 대여, 여신" },
    ],
  },
  investment: {
    phonetic: "/ɪnˈvest.mənt/",
    meanings: [
      { pos: "명사", def: "투자, 투자금" },
    ],
  },
  investments: {
    phonetic: "/ɪnˈvest.mənts/",
    meanings: [
      { pos: "명사", def: "투자, 투자금" },
    ],
  },
  harness: {
    phonetic: "/ˈhɑːr.nəs/",
    meanings: [
      { pos: "동사", def: "활용하다, 이용하다" },
      { pos: "명사", def: "마구, 안전벨트" },
    ],
  },
  insight: {
    phonetic: "/ˈɪn.saɪt/",
    meanings: [
      { pos: "명사", def: "통찰력, 안목, 통찰" },
    ],
  },
  insights: {
    phonetic: "/ˈɪn.saɪts/",
    meanings: [
      { pos: "명사", def: "통찰력, 깊은 식견" },
    ],
  },
  competitive: {
    phonetic: "/kəmˈpet̬.ə.t̬ɪv/",
    meanings: [
      { pos: "형용사", def: "경쟁력 있는, 경쟁적인" },
    ],
  },
  superior: {
    phonetic: "/səˈpɪr.i.ɚ/",
    meanings: [
      { pos: "형용사", def: "우수한, 뛰어난, 상위의" },
      { pos: "명사", def: "상관, 상급자" },
    ],
  },
  analysis: {
    phonetic: "/əˈnæl.ə.sɪs/",
    meanings: [
      { pos: "명사", def: "분석, 분석 결과, 검토" },
    ],
  },
  alternative: {
    phonetic: "/ɑːlˈtɝː.nə.t̬ɪv/",
    meanings: [
      { pos: "명사", def: "대안, 선택 가능한 것" },
      { pos: "형용사", def: "대안의, 대체 가능한" },
    ],
  },
  alternatives: {
    phonetic: "/ɑːlˈtɝː.nə.t̬ɪvz/",
    meanings: [
      { pos: "명사", def: "대안들, 선택지" },
    ],
  },
  expectation: {
    phonetic: "/ˌek.spekˈteɪ.ʃən/",
    meanings: [
      { pos: "명사", def: "기대, 예상, 기대치" },
    ],
  },
  expectations: {
    phonetic: "/ˌek.spekˈteɪ.ʃənz/",
    meanings: [
      { pos: "명사", def: "기대, 예상, 기대치" },
    ],
  },
};

export const DISTRACTOR_POOL_KOREAN = [
  "갑작스럽게 중단하다",
  "서로 상충하다, 모순되다",
  "극도로 분노하다",
  "가치를 과대평가하다",
  "임시로 대체하다",
  "신중하게 고려하다",
  "완전히 제거하다",
  "불필요하게 반복하다",
  "우연히 마주치다",
  "겉보기에만 화려한",
  "비밀리에 추진하다",
  "강력하게 반발하다",
  "천천히 침식되다",
  "적극적으로 옹호하다",
  "엄격하게 통제하다",
  "호기심을 유발하다",
];

const POS_MAP: Record<string, string> = {
  noun: "명사",
  verb: "동사",
  adjective: "형용사",
  adverb: "부사",
  preposition: "전치사",
  conjunction: "접속사",
};

// Client-side in-memory dictionary cache (0ms instant response)
const clientDictCache = new Map<string, DictSearchResult>();

export async function lookupDictionary(rawWord: string): Promise<DictSearchResult> {
  const word = rawWord.trim().toLowerCase();
  if (!word) {
    return {
      word: '',
      phonetic: '',
      meanings: [],
      sourceName: '단어 없음',
    };
  }

  // 1. Instant Cache Hit (0ms)
  const cached = clientDictCache.get(word);
  if (cached) {
    return cached;
  }

  // 2. Instant Built-in DB Check (0ms, no network required!)
  if (BUILTIN_KOREAN_DICT[word]) {
    const builtinResult: DictSearchResult = {
      word,
      phonetic: BUILTIN_KOREAN_DICT[word].phonetic || `/${word}/`,
      meanings: BUILTIN_KOREAN_DICT[word].meanings,
      sourceName: '로컬 정밀 영한 사전',
    };
    clientDictCache.set(word, builtinResult);
    return builtinResult;
  }

  let phonetic = `/${word}/`;

  // 3. Call internal server API route (Server fetches Google Translate & Phonetics in parallel with 1.2s timeout)
  // 3. Call internal server API route (Server fetches Google Translate, Gemini AI & Phonetics)
  try {
    const geminiKey =
      typeof window !== 'undefined'
        ? localStorage.getItem('context_vocab_gemini_key') || ''
        : '';
    const apiRes = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`, {
      headers: geminiKey ? { 'x-gemini-key': geminiKey } : {},
      signal: AbortSignal.timeout(3500),
    });
    if (apiRes.ok) {
      const data: DictSearchResult = await apiRes.json();
      if (
        data &&
        data.sourceName !== '수동 입력 모드' &&
        data.meanings &&
        data.meanings.length > 0
      ) {
        // Sanitize out crowdsourced errors & dummy placeholders
        const validMeanings = data.meanings.filter(
          (m) =>
            m.def &&
            m.pos !== '직접입력' &&
            !m.def.includes('직접 입력') &&
            !['성업', '큐브 뷰', '큐브뷰', '번역', 'matecat', 'mymemory'].includes(m.def.trim().toLowerCase())
        );
        if (validMeanings.length > 0) {
          const sanitized = { ...data, meanings: validMeanings };
          clientDictCache.set(word, sanitized);
          return sanitized;
        }
      }
    }
  } catch (apiErr) {
    console.warn('Internal dictionary API fast fallback:', apiErr);
  }

  // 4. Fast Google Translate Client Fallback (Direct attempt with 2s timeout)
  try {
    const gRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(2000) }
    );
    if (gRes.ok) {
      const gData = await gRes.json();
      const meanings: MeaningOption[] = [];
      const seenDefs = new Set<string>();

      // 1순위: 최우선 대표 기본 번역 뜻 (예: perspective -> '관점')
      if (gData[0]?.[0]?.[0]) {
        const main = String(gData[0][0][0]).trim();
        if (main && !['성업', '큐브 뷰', '큐브뷰', '번역'].includes(main)) {
          seenDefs.add(main);
          meanings.push({
            pos: '단어',
            def: main,
          });
        }
      }

      // 2순위: 품사별 세부 번역 뜻
      if (gData[1] && Array.isArray(gData[1])) {
        gData[1].forEach((entry: any) => {
          const posEn = entry[0];
          const posKo = POS_MAP[posEn] || posEn;
          const defs = entry[1] || [];

          defs.slice(0, 4).forEach((d: string) => {
            const trimmed = String(d || '').trim();
            if (trimmed && !seenDefs.has(trimmed) && !['성업', '큐브 뷰', '큐브뷰', '번역'].includes(trimmed)) {
              seenDefs.add(trimmed);
              meanings.push({
                pos: posKo,
                def: trimmed,
              });
            }
          });
        });
      }

      if (meanings.length > 0) {
        const gResult: DictSearchResult = {
          word,
          phonetic,
          meanings,
          sourceName: '표준 영한 사전',
        };
        clientDictCache.set(word, gResult);
        return gResult;
      }
    }
  } catch (err) {
    console.warn('Google translate lookup fallback:', err);
  }

  // 5. Final fallback
  const fallbackResult: DictSearchResult = {
    word,
    phonetic,
    meanings: [],
    sourceName: '수동 입력 모드',
  };
  clientDictCache.set(word, fallbackResult);
  return fallbackResult;
}

export function speakWordTTS(word: string, voiceCode: string = "en-US") {
  speakNatural(word, voiceCode);
}

export function speakSentenceTTS(text: string, voiceCode: string = "en-US") {
  speakNatural(text, voiceCode);
}

export function preloadSentenceTTS(text: string, voiceCode: string = "en-US") {
  if (!text) return;
  preloadNaturalAudioTTS(text, voiceCode);
}

export function preloadWordTTS(word: string, voiceCode: string = "en-US") {
  if (!word) return;
  preloadNaturalAudioTTS(word, voiceCode);
}
