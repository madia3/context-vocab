// 고음질 자연스러운 원어민 TTS (Studio Human Audio + Neural TTS + 프리미엄 브라우저 음성)

let currentAudio: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

// 브라우저 음성 목록 사전 로드 (비동기 로딩 대응)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) cachedVoices = v;
    } catch {
      // ignore
    }
  };
  loadVoices();
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  } else if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// 브라우저 내장 음성 중 가장 자연스러운 프리미엄/뉴럴 음성 자동 탐색
export function getBestVoice(langPrefix: string = 'en-US'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const targetPrefix = langPrefix.slice(0, 2).toLowerCase();
  const isTargetLang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith(targetPrefix);

  // 1순위: Siri, Natural, Premium, Enhanced 고음질 뉴럴 음성
  const topKeywords = ['Natural', 'Premium', 'Enhanced', 'Neural', 'Siri', 'Online (Natural)'];
  for (const kw of topKeywords) {
    const found = voices.find((v) => isTargetLang(v) && v.name.includes(kw));
    if (found) return found;
  }

  // 2순위: 검증된 최고급 원어민 음성 목록
  const preferredNames = [
    'Google US English',
    'Google UK English Female',
    'Google UK English Male',
    'Samantha',
    'Ava',
    'Allison',
    'Karen',
    'Daniel',
    'Serena',
    'Oliver',
  ];

  for (const name of preferredNames) {
    const found = voices.find((v) => isTargetLang(v) && v.name.includes(name));
    if (found) return found;
  }

  // 3순위: 해당 언어의 기본 음성
  const standard = voices.find(isTargetLang);
  return standard || voices[0] || null;
}

// 1. 고음질 원어민 오디오 스트림 (/api/tts: 실제 스튜디오 인간 녹음 및 뉴럴 발음)
export function playNaturalAudioTTS(text: string, lang: string = 'en-US'): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const cleanText = text.trim();
      if (!cleanText) {
        resolve(true);
        return;
      }

      const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(lang)}`;
      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.onended = () => resolve(true);
      audio.onerror = () => {
        resolve(false);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => resolve(true))
          .catch((err) => {
            console.warn('Audio play auto-play blocked or failed, fallback to WebSpeech:', err);
            resolve(false);
          });
      }
    } catch {
      resolve(false);
    }
  });
}

// 2. 브라우저 프리미엄 Web Speech (오프라인 및 즉각 재생용)
export function playWebSpeechTTS(text: string, voiceCode: string = 'en-US', rate: number = 0.96): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate; // 원어민의 자연스럽고 편안한 대화 속도
    utterance.pitch = 1.0;
    utterance.lang = voiceCode;

    const bestVoice = getBestVoice(voiceCode);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);

    window.speechSynthesis.speak(utterance);
  });
}

// 하위 호환성을 위한 별칭
export const playGoogleNativeTTS = playNaturalAudioTTS;

// 3. 통합 최적화 낭독기: 진짜 원어민 스튜디오/뉴럴 오디오 우선 -> 실패 시 브라우저 최고급 음성
export async function speakNatural(text: string, voiceCode: string = 'en-US') {
  if (!text || typeof text !== 'string') return;

  const clean = text.trim();
  if (!clean) return;

  // 기존 재생 중지
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // 1순위: 스튜디오 원어민 녹음 및 고품질 뉴럴 오디오 재생
  const success = await playNaturalAudioTTS(clean, voiceCode);
  if (success) return;

  // 2순위: 네트워크 불가 또는 오디오 차단 시 브라우저 프리미엄 음성으로 자연스럽게 재생
  await playWebSpeechTTS(clean, voiceCode);
}
