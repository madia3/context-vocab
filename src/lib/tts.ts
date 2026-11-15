// 고음질 원어민 TTS (Google Native Audio + 프리미엄 브라우저 뉴럴 보이스 하이브리드)

let currentAudio: HTMLAudioElement | null = null;

// 브라우저 내장 음성 중 가장 자연스러운 프리미엄 음성 자동 탐색
export function getBestVoice(langPrefix: string = 'en'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1순위: 자연스러운 고음질(Enhanced/Premium/Google) 음성 우선순위 리스트
  const preferredNames = [
    'Google US English',
    'Samantha (Enhanced)',
    'Ava (Premium)',
    'Ava (Enhanced)',
    'Serena (Premium)',
    'Allison (Enhanced)',
    'Samantha',
    'Daniel (Enhanced)',
    'Google UK English Female',
    'Karen',
  ];

  for (const name of preferredNames) {
    const found = voices.find((v) => v.name.includes(name));
    if (found) return found;
  }

  // 2순위: Enhanced 또는 Natural 키워드가 포함된 영어 음성
  const enhanced = voices.find(
    (v) => v.lang.startsWith(langPrefix) && (v.name.includes('Enhanced') || v.name.includes('Natural'))
  );
  if (enhanced) return enhanced;

  // 3순위: 일반 영어 음성
  const standard = voices.find((v) => v.lang.startsWith(langPrefix));
  return standard || voices[0] || null;
}

// 1. 구글 원어민 고음질 오디오 (기계음 없는 진짜 원어민 음성)
export function playGoogleNativeTTS(text: string, lang: string = 'en'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // 구글 공식 고음질 발음 오디오 스트림
      const cleanText = text.trim();
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(
        cleanText
      )}`;

      const audio = new Audio(url);
      currentAudio = audio;
      audio.playbackRate = 0.95;

      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => resolve(true)).catch(() => resolve(false));
      }
    } catch (e) {
      resolve(false);
    }
  });
}

// 2. 브라우저 프리미엄 Web Speech (장문 및 로컬 재생)
export function playWebSpeechTTS(text: string, voiceCode: string = 'en-US', rate: number = 0.92): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate; // 오디오북처럼 편안하고 또렷한 속도
    utterance.pitch = 1.0;
    utterance.lang = voiceCode;

    const bestVoice = getBestVoice(voiceCode.slice(0, 2));
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);

    window.speechSynthesis.speak(utterance);
  });
}

// 3. 통합 최적화 낭독기: 구글 원어민 오디오 우선 -> 실패 시 프리미엄 Web Speech
export async function speakNatural(text: string, voiceCode: string = 'en-US') {
  if (!text) return;

  // 기존 음성 중지
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // 150자 미만 문장은 구글 고음질 원어민 음성으로 즉각 재생
  if (text.length <= 150) {
    const success = await playGoogleNativeTTS(text, voiceCode.startsWith('en-GB') ? 'en-GB' : 'en');
    if (success) return;
  }

  // 장문이거나 구글 스트림 불가 시 브라우저 최고급 음성으로 재생
  await playWebSpeechTTS(text, voiceCode);
}
