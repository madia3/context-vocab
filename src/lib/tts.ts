// 고음질 자연스러운 원어민 TTS (Studio Human Audio + Neural TTS + 프리미엄 브라우저 음성)

let currentAudio: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let currentTtsRate: number = 1.0;

export function setTtsPlaybackRate(rate: number) {
  const clamped = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));
  currentTtsRate = Math.round(clamped * 100) / 100;
  if (typeof window !== 'undefined') {
    localStorage.setItem('context_vocab_tts_rate', String(currentTtsRate));
  }
}

export function getTtsPlaybackRate(): number {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('context_vocab_tts_rate');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
        currentTtsRate = parsed;
      }
    }
  }
  return currentTtsRate;
}

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

// Client-side Memory Cache for Preloaded Audio Blobs
interface PreloadedAudioEntry {
  blobUrl: string;
  timestamp: number;
}

const audioBlobCache = new Map<string, PreloadedAudioEntry>();
const inFlightPreloads = new Map<string, Promise<string | null>>();
const MAX_CACHE_ENTRIES = 50;

function getCacheKey(text: string, lang: string): string {
  return `${lang}:${text.trim().toLowerCase()}`;
}

/**
 * 오디오를 백그라운드에서 미리 다운로드하여 메모리(Blob URL)에 캐싱해 둡니다.
 * 퀴즈 문제가 출제되는 순간 미리 준비하여, 문장이 화면에 뜨자마자 지연 없이(0ms) 바로 읽어줄 수 있습니다.
 */
export async function preloadNaturalAudioTTS(text: string, lang: string = 'en-US'): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const cleanText = text.trim();
  if (!cleanText) return null;

  const key = getCacheKey(cleanText, lang);

  // 1. 이미 메모리에 캐시되어 있는 경우
  const existing = audioBlobCache.get(key);
  if (existing) {
    existing.timestamp = Date.now();
    return existing.blobUrl;
  }

  // 2. 이미 다운로드 진행 중인 경우 기존 Promise 반환
  if (inFlightPreloads.has(key)) {
    return inFlightPreloads.get(key)!;
  }

  // 3. 백그라운드 프리로드 시작
  const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(lang)}`;

  const preloadPromise = (async () => {
    try {
      const res = await fetch(audioUrl, {
        headers: { Accept: 'audio/mpeg, audio/*' },
      });
      if (!res.ok) return null;

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      // 캐시 크기 관리 (오래된 항목 정리)
      if (audioBlobCache.size >= MAX_CACHE_ENTRIES) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        audioBlobCache.forEach((v, k) => {
          if (v.timestamp < oldestTime) {
            oldestTime = v.timestamp;
            oldestKey = k;
          }
        });
        if (oldestKey) {
          const oldEntry = audioBlobCache.get(oldestKey);
          if (oldEntry?.blobUrl) {
            try {
              URL.revokeObjectURL(oldEntry.blobUrl);
            } catch {}
          }
          audioBlobCache.delete(oldestKey);
        }
      }

      audioBlobCache.set(key, {
        blobUrl,
        timestamp: Date.now(),
      });

      return blobUrl;
    } catch (e) {
      console.warn('TTS preload failed:', e);
      return null;
    } finally {
      inFlightPreloads.delete(key);
    }
  })();

  inFlightPreloads.set(key, preloadPromise);
  return preloadPromise;
}

// 1. 고음질 원어민 오디오 스트림 (/api/tts: 실제 스튜디오 인간 녹음 및 뉴럴 발음)
export function playNaturalAudioTTS(text: string, lang: string = 'en-US', rate?: number): Promise<boolean> {
  return new Promise(async (resolve) => {
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

      const key = getCacheKey(cleanText, lang);

      // 1. 이미 프리로드 완료된 Blob URL이 있는 경우 -> 메모리에서 0초 지연 즉각 재생!
      let targetSourceUrl: string | null = null;
      const cached = audioBlobCache.get(key);
      if (cached) {
        cached.timestamp = Date.now();
        targetSourceUrl = cached.blobUrl;
      } else if (inFlightPreloads.has(key)) {
        // 프리로드가 완료 직전인 경우 짧게 대기(최대 500ms)
        try {
          const readyBlobUrl = await Promise.race([
            inFlightPreloads.get(key)!,
            new Promise<null>((r) => setTimeout(() => r(null), 500)),
          ]);
          if (readyBlobUrl) {
            targetSourceUrl = readyBlobUrl;
          }
        } catch {}
      }

      if (!targetSourceUrl) {
        targetSourceUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(lang)}`;
      }

      const playbackSpeed = typeof rate === 'number' ? rate : getTtsPlaybackRate();
      const audio = new Audio(targetSourceUrl);
      audio.playbackRate = playbackSpeed;
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
export function playWebSpeechTTS(text: string, voiceCode: string = 'en-US', rate?: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }

    window.speechSynthesis.cancel();

    const currentRate = typeof rate === 'number' ? rate : getTtsPlaybackRate();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = currentRate;
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
export async function speakNatural(text: string, voiceCode: string = 'en-US', rate?: number) {
  if (!text || typeof text !== 'string') return;

  const clean = text.trim();
  if (!clean) return;

  if (typeof rate === 'number') {
    setTtsPlaybackRate(rate);
  }

  // 기존 재생 중지
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // 1순위: 스튜디오 원어민 녹음 및 고품질 뉴럴 오디오 재생
  const success = await playNaturalAudioTTS(clean, voiceCode, rate);
  if (success) return;

  // 2순위: 네트워크 불가 또는 오디오 차단 시 브라우저 프리미엄 음성으로 자연스럽게 재생
  await playWebSpeechTTS(clean, voiceCode, rate);
}
