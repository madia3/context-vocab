// 고음질 자연스러운 원어민 TTS (Studio Human Audio + Neural TTS + 프리미엄 브라우저 음성)

export type TtsGender = 'female' | 'male' | 'random';
type ResolvedGender = 'female' | 'male';
type ResolvedLang = 'en-US' | 'en-GB';

let currentAudio: HTMLAudioElement | null = null;
let sharedAudioElement: HTMLAudioElement | null = null;
let bgKeepAliveCtx: AudioContext | null = null;
let bgKeepAliveOsc: OscillatorNode | null = null;
let cancelCurrentPlayback: (() => void) | null = null;
let activeSpeechId = 0;
let cachedVoices: SpeechSynthesisVoice[] = [];
let currentTtsRate: number = 1.0;
let currentTtsGender: TtsGender = 'random';
let currentTtsBackgroundPlay: boolean = false;
let lastRandomVariantKey: string = '';

export function setTtsBackgroundPlay(enabled: boolean) {
  currentTtsBackgroundPlay = Boolean(enabled);
  if (typeof window !== 'undefined') {
    localStorage.setItem('context_vocab_tts_background_play', currentTtsBackgroundPlay ? '1' : '0');
  }
}

export function getTtsBackgroundPlay(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('context_vocab_tts_background_play');
    if (saved === '0') {
      currentTtsBackgroundPlay = false;
      return false;
    }
    if (saved === '1') {
      currentTtsBackgroundPlay = true;
      return true;
    }
  }
  return currentTtsBackgroundPlay;
}

function getSharedAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioElement) {
    const audio = new Audio();
    audio.preload = 'auto';
    // iOS Safari 인라인/백그라운드 오디오 연속 재생 허용
    (audio as any).playsInline = true;
    sharedAudioElement = audio;
  }
  return sharedAudioElement;
}

// 아주 짧은 무음 WAV (사용자 클릭 직후 Audio 엘리먼트 잠금 해제용)
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * 사용자 클릭 이벤트 안에서 동기적으로 호출해 공유 Audio 엘리먼트의 백그라운드 재생 권한을 확보합니다.
 */
export function unlockAudioForBackground() {
  if (typeof window === 'undefined') return;
  try {
    const audio = getSharedAudioElement();
    if (audio && audio.paused && !audio.src) {
      audio.src = SILENT_WAV_DATA_URI;
      audio.volume = 0.01;
      const p = audio.play();
      if (p) {
        p.then(() => {
          // 이미 실제 TTS 오디오로 교체된 경우에는 절대 pause하지 않음
          if (audio.src === SILENT_WAV_DATA_URI) {
            audio.pause();
            audio.currentTime = 0;
          }
          audio.volume = 1.0;
        }).catch(() => {
          audio.volume = 1.0;
        });
      }
    }
  } catch {}
}

/**
 * 백그라운드 탭에서 브라우저가 문장 간 타이머/오디오 세션을 동결하지 않도록
 * 비가청 무음 AudioContext를 연속 낭독 중에만 유지합니다.
 */
export function startBackgroundAudioKeepAlive() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!bgKeepAliveCtx || bgKeepAliveCtx.state === 'closed') {
      bgKeepAliveCtx = new AudioCtx();
    }
    if (bgKeepAliveCtx.state === 'suspended') {
      bgKeepAliveCtx.resume().catch(() => {});
    }
    if (!bgKeepAliveOsc) {
      const osc = bgKeepAliveCtx.createOscillator();
      const gain = bgKeepAliveCtx.createGain();
      osc.frequency.value = 20;
      gain.gain.value = 0.00001; // 완전 비가청 수준
      osc.connect(gain);
      gain.connect(bgKeepAliveCtx.destination);
      osc.start();
      bgKeepAliveOsc = osc;
    }
  } catch {}
}

export function stopBackgroundAudioKeepAlive() {
  try {
    if (bgKeepAliveOsc) {
      bgKeepAliveOsc.stop();
      bgKeepAliveOsc.disconnect();
      bgKeepAliveOsc = null;
    }
    if (bgKeepAliveCtx && bgKeepAliveCtx.state !== 'closed') {
      bgKeepAliveCtx.close().catch(() => {});
      bgKeepAliveCtx = null;
    }
  } catch {}
}

export function updateMediaSession(options: {
  title: string;
  artist?: string;
  album?: string;
  playbackState?: 'playing' | 'paused';
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    if (typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: options.title || '원서. 문장. 단어.',
        artist: options.artist || '원어민 문장 연속 듣기',
        album: options.album || '원서. 문장. 단어.',
      });
    }
    navigator.mediaSession.playbackState = options.playbackState || 'playing';
    navigator.mediaSession.setActionHandler('play', options.onPlay || null);
    navigator.mediaSession.setActionHandler('pause', options.onPause || options.onStop || null);
    navigator.mediaSession.setActionHandler('stop', options.onStop || null);
    navigator.mediaSession.setActionHandler('previoustrack', options.onPrev || null);
    navigator.mediaSession.setActionHandler('nexttrack', options.onNext || null);
  } catch {}
}

export function clearMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = 'none';
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('stop', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
  } catch {}
}

export function setTtsVoiceGender(gender: TtsGender) {
  currentTtsGender = gender === 'male' || gender === 'random' ? gender : 'female';
  if (typeof window !== 'undefined') {
    localStorage.setItem('context_vocab_tts_gender', currentTtsGender);
  }
}

export function getTtsVoiceGender(): TtsGender {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('context_vocab_tts_gender');
    if (saved === 'male' || saved === 'female' || saved === 'random') {
      currentTtsGender = saved;
      return currentTtsGender;
    }
  }
  return currentTtsGender;
}

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
        return currentTtsRate;
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
export function getBestVoice(langPrefix: string = 'en-US', gender?: TtsGender): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const targetPrefix = langPrefix.slice(0, 2).toLowerCase();
  const isTargetLang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith(targetPrefix);
  const targetGender = gender || getTtsVoiceGender();

  // 1순위: 성별 매칭 우선 검증된 원어민 음성
  const preferredNames =
    targetGender === 'male'
      ? ['Brian', 'Christopher', 'Guy', 'Ryan', 'Daniel', 'Google UK English Male', 'Oliver', 'Alex', 'Aaron', 'Fred']
      : ['Ava', 'Sonia', 'Samantha', 'Google UK English Female', 'Allison', 'Karen', 'Serena', 'Google US English'];

  for (const name of preferredNames) {
    const found = voices.find((v) => isTargetLang(v) && v.name.includes(name));
    if (found) return found;
  }

  // 2순위: Siri, Natural, Premium, Enhanced 고음질 뉴럴 음성
  const topKeywords = ['Natural', 'Premium', 'Enhanced', 'Neural', 'Siri', 'Online (Natural)'];
  for (const kw of topKeywords) {
    const found = voices.find((v) => isTargetLang(v) && v.name.includes(kw));
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
const preloadedRandomVariants = new Map<string, { lang: ResolvedLang; gender: ResolvedGender }>();
const MAX_CACHE_ENTRIES = 50;

function getCacheKey(text: string, lang: string, gender: ResolvedGender): string {
  return `${lang}:${gender}:${text.trim().toLowerCase()}`;
}

function pickRandomVoiceVariant(
  langSetting: string,
  genderSetting: TtsGender
): { lang: ResolvedLang; gender: ResolvedGender } {
  const langs: ResolvedLang[] =
    langSetting === 'random'
      ? ['en-US', 'en-GB']
      : [langSetting.startsWith('en-GB') ? 'en-GB' : 'en-US'];
  const genders: ResolvedGender[] =
    genderSetting === 'random' ? ['female', 'male'] : [genderSetting];

  const pool: Array<{ lang: ResolvedLang; gender: ResolvedGender }> = [];
  for (const l of langs) {
    for (const g of genders) {
      pool.push({ lang: l, gender: g });
    }
  }

  if (pool.length === 1) return pool[0];

  // 직전에 재생한 목소리와 다른 조합을 우선 선택해 랜덤 체감을 높임
  const filtered = pool.filter((item) => `${item.lang}:${item.gender}` !== lastRandomVariantKey);
  const candidates = filtered.length > 0 ? filtered : pool;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  lastRandomVariantKey = `${chosen.lang}:${chosen.gender}`;
  return chosen;
}

function resolveTtsVariant(
  text: string,
  langSetting: string,
  genderSetting: TtsGender,
  mode: 'preload' | 'play'
): { lang: ResolvedLang; gender: ResolvedGender } {
  const isRandomMode = langSetting === 'random' || genderSetting === 'random';
  if (!isRandomMode) {
    return {
      lang: langSetting.startsWith('en-GB') ? 'en-GB' : 'en-US',
      gender: genderSetting,
    };
  }

  const textKey = `${langSetting}:${genderSetting}:${text.trim().toLowerCase()}`;
  if (mode === 'play') {
    const preloaded = preloadedRandomVariants.get(textKey);
    if (preloaded) {
      preloadedRandomVariants.delete(textKey);
      lastRandomVariantKey = `${preloaded.lang}:${preloaded.gender}`;
      return preloaded;
    }
    return pickRandomVoiceVariant(langSetting, genderSetting);
  }

  // preload 모드: 이미 해당 문장에 대해 선택된 랜덤 조합이 있으면 재사용
  const existing = preloadedRandomVariants.get(textKey);
  if (existing) return existing;

  const chosen = pickRandomVoiceVariant(langSetting, genderSetting);
  if (preloadedRandomVariants.size > 40) {
    const firstKey = preloadedRandomVariants.keys().next().value;
    if (firstKey) preloadedRandomVariants.delete(firstKey);
  }
  preloadedRandomVariants.set(textKey, chosen);
  return chosen;
}

/**
 * 오디오를 백그라운드에서 미리 다운로드하여 메모리(Blob URL)에 캐싱해 둡니다.
 * 퀴즈 문제가 출제되는 순간 미리 준비하여, 문장이 화면에 뜨자마자 지연 없이(0ms) 바로 읽어줄 수 있습니다.
 */
export async function preloadNaturalAudioTTS(text: string, lang: string = 'en-US'): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const cleanText = text.trim();
  if (!cleanText) return null;

  const genderSetting = getTtsVoiceGender();
  const resolved = resolveTtsVariant(cleanText, lang, genderSetting, 'preload');
  const key = getCacheKey(cleanText, resolved.lang, resolved.gender);

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
  const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(resolved.lang)}&gender=${resolved.gender}&v=2`;

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
export function playNaturalAudioTTS(
  text: string,
  lang: string = 'en-US',
  rate?: number,
  expectedSpeechId?: number
): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      if (currentAudio) {
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.onpause = null;
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }

      const cleanText = text.trim();
      if (!cleanText) {
        finish(true);
        return;
      }

      const genderSetting = getTtsVoiceGender();
      const resolved = resolveTtsVariant(cleanText, lang, genderSetting, 'play');
      const key = getCacheKey(cleanText, resolved.lang, resolved.gender);

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

      // 프리로드 대기 중 다른 재생/중지 요청이 들어왔으면 중단 (폴백 실행 방지)
      if (typeof expectedSpeechId === 'number' && expectedSpeechId !== activeSpeechId) {
        finish(false);
        return;
      }

      if (!targetSourceUrl) {
        targetSourceUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(resolved.lang)}&gender=${resolved.gender}&v=2`;
      }

      const playbackSpeed = typeof rate === 'number' ? rate : getTtsPlaybackRate();
      // 공유 Audio 엘리먼트를 재사용해야 다른 브라우저 탭/백그라운드 전환 후에도 자동재생 차단을 피하고 연속 재생됨
      const audio = getSharedAudioElement() || new Audio();
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.volume = 1.0;
      audio.src = targetSourceUrl;
      audio.playbackRate = playbackSpeed;
      audio.currentTime = 0;
      currentAudio = audio;

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onpause = null;
        if (currentAudio === audio) {
          currentAudio = null;
        }
        if (cancelCurrentPlayback === onCancel) {
          cancelCurrentPlayback = null;
        }
      };

      const onCancel = () => {
        cleanup();
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
        finish(false);
      };

      cancelCurrentPlayback = onCancel;

      // Chrome에서는 오디오 정상 종료 시 ended 직전에 pause 이벤트가 먼저 발생하므로
      // onpause에서 resolve(false)를 호출하면 WebSpeech 폴백이 중복 실행됨!
      // 따라서 정상 종료(onended)와 실제 오류(onerror)만 처리합니다.
      audio.onended = () => {
        cleanup();
        finish(true);
      };
      audio.onerror = () => {
        cleanup();
        finish(false);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          cleanup();
          console.warn('Audio play auto-play blocked or failed, fallback to WebSpeech:', err);
          finish(false);
        });
      }
    } catch {
      finish(false);
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

    const resolved = pickRandomVoiceVariant(voiceCode, getTtsVoiceGender());
    const currentRate = typeof rate === 'number' ? rate : getTtsPlaybackRate();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = currentRate;
    utterance.pitch = 1.0;
    utterance.lang = resolved.lang;

    const bestVoice = getBestVoice(resolved.lang, resolved.gender);
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

// 전체 TTS 음성 재생 중지 함수
export function stopTTS() {
  activeSpeechId += 1;

  if (cancelCurrentPlayback) {
    const cancel = cancelCurrentPlayback;
    cancelCurrentPlayback = null;
    try {
      cancel();
    } catch {}
  }

  if (currentAudio) {
    try {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.onpause = null;
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

// 3. 통합 최적화 낭독기: 진짜 원어민 스튜디오/뉴럴 오디오 우선 -> 실패 시 브라우저 최고급 음성
export async function speakNatural(text: string, voiceCode: string = 'en-US', rate?: number): Promise<boolean> {
  if (!text || typeof text !== 'string') return false;

  const clean = text.trim();
  if (!clean) return false;

  if (typeof rate === 'number') {
    setTtsPlaybackRate(rate);
  }

  // 기존 재생 중지 및 새 재생 세션 발급
  stopTTS();
  const mySpeechId = activeSpeechId;

  // 1순위: 스튜디오 원어민 녹음 및 고품질 뉴럴 오디오 재생
  const success = await playNaturalAudioTTS(clean, voiceCode, rate, mySpeechId);
  if (success) return true;

  // 재생 도중 다른 요청으로 취소/중지된 경우에는 WebSpeech 폴백을 실행하지 않음
  if (mySpeechId !== activeSpeechId) return false;

  // 2순위: 네트워크 불가 또는 오디오 차단 시 브라우저 프리미엄 음성으로 자연스럽게 재생
  return await playWebSpeechTTS(clean, voiceCode, rate);
}

