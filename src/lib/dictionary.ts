import { DictSearchResult, MeaningOption } from '@/types/vocab';
import { speakNatural } from './tts';

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

export async function lookupDictionary(rawWord: string): Promise<DictSearchResult> {
  const word = rawWord.trim().toLowerCase();
  let phonetic = `/${word}/`;

  // Step 1: Phonetics Lookup
  try {
    const pRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData[0]?.phonetic) {
        phonetic = pData[0].phonetic;
      } else if (pData[0]?.phonetics?.[0]?.text) {
        phonetic = pData[0].phonetics[0].text;
      }
    }
  } catch (e) {
    console.warn("Phonetic lookup warning:", e);
  }

  // Step 2: Check Built-in DB
  if (BUILTIN_KOREAN_DICT[word]) {
    return {
      word,
      phonetic: BUILTIN_KOREAN_DICT[word].phonetic || phonetic,
      meanings: BUILTIN_KOREAN_DICT[word].meanings,
      sourceName: "로컬 정밀 영한 사전",
    };
  }

  // Step 3: Google Translate Official API
  try {
    const gRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&dt=bd&q=${encodeURIComponent(word)}`
    );
    if (gRes.ok) {
      const gData = await gRes.json();
      const meanings: MeaningOption[] = [];

      if (gData[1] && Array.isArray(gData[1])) {
        gData[1].forEach((entry: any) => {
          const posEn = entry[0];
          const posKo = POS_MAP[posEn] || posEn;
          const defs = entry[1] || [];

          defs.slice(0, 3).forEach((d: string) => {
            meanings.push({
              pos: posKo,
              def: d,
            });
          });
        });
      }

      if (meanings.length === 0 && gData[0]?.[0]?.[0]) {
        meanings.push({
          pos: "주요 뜻",
          def: gData[0][0][0],
        });
      }

      if (meanings.length > 0) {
        return {
          word,
          phonetic,
          meanings,
          sourceName: "실시간 영한 사전",
        };
      }
    }
  } catch (err) {
    console.warn("Google translate lookup fallback:", err);
  }

  // Step 4: MyMemory API Fallback
  try {
    const mRes = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`
    );
    if (mRes.ok) {
      const mData = await mRes.json();
      const meanings: MeaningOption[] = [];
      if (mData.responseData?.translatedText) {
        meanings.push({ pos: "대표 뜻", def: mData.responseData.translatedText });
      }
      if (mData.matches) {
        mData.matches.slice(0, 3).forEach((m: any) => {
          if (m.translation && !meanings.some((x) => x.def === m.translation)) {
            meanings.push({ pos: "뜻", def: m.translation });
          }
        });
      }
      if (meanings.length > 0) {
        return {
          word,
          phonetic,
          meanings,
          sourceName: "글로벌 번역 사전",
        };
      }
    }
  } catch (err) {
    console.error("MyMemory error:", err);
  }

  // Final fallback
  return {
    word,
    phonetic,
    meanings: [{ pos: "직접 입력", def: "한국어 뜻을 직접 입력해 주세요." }],
    sourceName: "수동 입력 모드",
  };
}

export function speakWordTTS(word: string, voiceCode: string = "en-US") {
  speakNatural(word, voiceCode);
}

export function speakSentenceTTS(text: string, voiceCode: string = "en-US") {
  speakNatural(text, voiceCode);
}
