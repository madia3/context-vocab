'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { VocabItem, DictSearchResult } from '@/types/vocab';
import {
  fetchVocabulary,
  addVocabularyItem,
  saveOrMergeVocabularyItem,
  deleteVocabularyItem,
  moveWordsToAnotherBook,
  deleteWordsByBook,
  updateVocabularyContext,
  updateVocabularySentenceTranslation,
  updateQuizStat,
  resetWithSamples,
  clearAllVocab,
  syncGuestWordsToUser,
  loadSamplesForUser,
} from '@/lib/vocabService';
import {
  lookupDictionary,
  speakWordTTS,
  speakSentenceTTS,
  preloadSentenceTTS,
  preloadWordTTS,
  setTtsPlaybackRate,
  DISTRACTOR_POOL_KOREAN,
  stopTTS,
} from '@/lib/dictionary';
import { getLiveDictCandidates, fetchLiveDictSuggestions, SuggestionItem } from '@/lib/autocomplete';
import {
  extractTextFromPageImage,
  findSentenceWithWord,
  findSentenceWithWordSmart,
  findAllSentencesWithWordSmart,
  extractLemmaCandidate,
  generateWordVariants,
  cleanOcrText,
} from '@/lib/ocr';
import {
  extractTextWithAI,
  findSentenceWithAI,
  getStoredGeminiKey,
  setStoredGeminiKey,
  setCurrentAiUserContext,
  buildAiRequestHeaders,
  setAiQuotaExceededHandler,
  notifyAiQuotaExceeded,
  fileToBase64,
  type AiQuotaExceededInfo,
  type OcrEngineType,
  type OcrTimingStats,
} from '@/lib/gemini';
import { fireConfetti } from '@/lib/confetti';
import {
  checkIsSupabaseConfigured,
  getStoredSupabaseConfig,
  setStoredSupabaseConfig,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
  sendPasswordResetEmail,
  updateUserPassword,
  getCurrentUser,
  getSupabaseClient,
  SUPABASE_SETUP_SQL,
} from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  Volume2,
  Trash2,
  Plus,
  BookOpen,
  Award,
  Settings,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Database,
  Bookmark,
  BookMarked,
  Layers,
  BarChart3,
  Camera,
  ScanLine,
  Check,
  RotateCw,
  Bot,
  Key,
  ExternalLink,
  Globe,
  Link2,
  User as UserIcon,
  LogOut,
  Copy,
  Cloud,
  ChevronDown,
  Image as ImageIcon,
  ClipboardPaste,
  Shuffle,
  Mail,
  Lock,
  FolderInput,
  Upload,
  X,
  LogIn,
  SlidersHorizontal,
  Languages,
  Square,
  CheckSquare,
  Gauge,
  Zap,
  Activity,
  Server,
  Shield,
  Download,
  Megaphone,
  Terminal,
  Play,
  RotateCcw,
  Info,
  Scissors,
} from 'lucide-react';
import { APP_BUILD_VERSION } from '@/lib/version';
import { isUserAdmin } from '@/lib/admin';
import {
  getStoredAnnouncement,
  saveStoredAnnouncement,
  ANNOUNCEMENT_CHANGED_EVENT,
  type AppAnnouncement,
} from '@/lib/announcement';
import {
  getAiUsageStats,
  recordAiUsage,
  AI_USAGE_EVENT,
  type AiUsageStats,
} from '@/lib/geminiUsage';
import { compressAvatarImage } from '@/lib/imageCompress';
import {
  getCustomAvatar,
  setCustomAvatar,
  getCustomDisplayName,
  updateProfile,
} from '@/lib/profileService';
import {
  saveBookSourceData,
  loadBookSourceData,
  deleteBookSourceData,
  migrateLegacySourceData,
} from '@/lib/bookSourceStorage';

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function getPosBadgeColor(pos?: string): string {
  const p = (pos || '').trim();
  if (p === '명사' || p.includes('명사')) return 'bg-brand-100 text-brand-800 border-brand-200';
  if (p === '동사' || p.includes('동사')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (p === '형용사' || p.includes('형용사')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (p === '부사' || p.includes('부사')) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (p === '전치사' || p === '접속사') return 'bg-teal-100 text-teal-800 border-teal-200';
  return 'bg-brand-50 text-brand-700 border-brand-200';
}

function isValidMeaningDef(def?: string): boolean {
  if (!def || typeof def !== 'string') return false;
  const t = def.trim();
  if (!t) return false;
  if (
    t.includes('직접 입력') ||
    t.includes('직접입력') ||
    t.includes('입력해 주세요') ||
    t.includes('한국어 뜻을')
  ) {
    return false;
  }
  return true;
}


interface WordEntryItem {
  id: string;
  word: string;
  context: string;
  sentenceTranslation?: string;
  sourceMemo: string;
  dictResult: DictSearchResult | null;
  selectedMeaning: string;
  selectedPos: string;
  customMeaning: string;
  isSearchingDict: boolean;
  isAnalyzingContext?: boolean; // 💡 AI가 문맥 문장, 최적 뜻, 한글 해석을 분석 중인 상태
  liveCandidates: SuggestionItem[];
  foundCandidateSentences?: string[];
  candidateSentences: string[];
  ocrDetectedNotice: string | null;
  isTrailingCutOff?: boolean; // ✂️ 다음 페이지로 문장이 이어져 잘린 상태 감지 플래그
}

function isSentenceCutOff(text?: string | null): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  const startsCutOff = /^[a-z]/.test(trimmed);
  const endsCutOff = !/[.!?]["'”’]?$/.test(trimmed);
  const endsWithHyphen = /-$/.test(trimmed);
  const endsWithDangling = /\b(and|or|but|that|which|with|for|of|in|on|at|to|by|from|as|because|the|a|an)\s*$/i.test(trimmed);
  return startsCutOff || endsCutOff || endsWithHyphen || endsWithDangling;
}

function createWordEntryItem(init?: Partial<WordEntryItem>): WordEntryItem {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    word: '',
    context: '',
    sentenceTranslation: '',
    sourceMemo: '',
    dictResult: null,
    selectedMeaning: '',
    selectedPos: '',
    customMeaning: '',
    isSearchingDict: false,
    isAnalyzingContext: false,
    liveCandidates: [],
    foundCandidateSentences: [],
    candidateSentences: [],
    ocrDetectedNotice: null,
    isTrailingCutOff: false,
    ...init,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'add' | 'list' | 'quiz'>('quiz');
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // 5지선다 퀴즈 기본 문제 수 설정 (기본값 20문제, 0은 전체)
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('context_vocab_quiz_question_count');
      if (saved) {
        const p = parseInt(saved, 10);
        if (!isNaN(p)) return p;
      }
    }
    return 20;
  });

  // Multi-Word Form State: 한 번에 여러 단어를 추가/등록할 수 있는 단어 등록칸 목록
  const [wordEntries, setWordEntries] = useState<WordEntryItem[]>([createWordEntryItem()]);
  const wordEntriesRef = useRef<WordEntryItem[]>(wordEntries);
  useEffect(() => {
    wordEntriesRef.current = wordEntries;
  }, [wordEntries]);
  const [inputBookTitle, setInputBookTitle] = useState('원서 첫걸음: 어린 왕자');
  // 단어 등록 시 복수 단어장 동시 저장 지원
  const [selectedTargetBooks, setSelectedTargetBooks] = useState<string[]>(['원서 첫걸음: 어린 왕자']);
  const [isCustomBook, setIsCustomBook] = useState(false);
  const [customBookInput, setCustomBookInput] = useState('');
  const [isAddBookDropdownOpen, setIsAddBookDropdownOpen] = useState(false);
  const addBookDropdownRef = useRef<HTMLDivElement>(null);
  // 단어장별 최근 사용 시각(타임스탬프) 기록
  const [bookUsageMap, setBookUsageMap] = useState<Record<string, number>>({});
  // 단어 목록 랜덤 순서 재배치를 위한 셔플 키
  const [shuffleKey, setShuffleKey] = useState(0);

  // 단어 등록 시 단어장 단일 선택 (목록형 1개만 선택 가능)
  function handleToggleTargetBook(bookTitle: string) {
    const trimmed = bookTitle.trim();
    if (!trimmed) return;
    setSelectedTargetBooks([trimmed]);
    if (trimmed !== inputBookTitle) {
      handleSwitchBook(trimmed);
    }
  }

  function touchBookUsage(bookTitle: string) {
    if (!bookTitle || bookTitle === '__custom__') return;
    const now = Date.now();
    setBookUsageMap((prev) => {
      const next = { ...prev, [bookTitle]: now };
      if (typeof window !== 'undefined') {
        localStorage.setItem('context_vocab_book_recency', JSON.stringify(next));
        localStorage.setItem('context_vocab_last_book_title', bookTitle);
      }
      return next;
    });
  }

  // 단어장 변경 시: 이전 단어장의 사진(최대 2장) 및 OCR 텍스트를 저장하고, 변경된 단어장의 사진을 복원
  async function handleSwitchBook(nextTitle: string) {
    const trimmedNext = nextTitle.trim();
    if (!trimmedNext) return;

    // 1) 이전 단어장의 사진 및 OCR 텍스트 저장
    const currentBook = inputBookTitle.trim();
    if (currentBook && currentBook !== '__custom__') {
      try {
        await saveBookSourceData(currentBook, sourceImagesRef.current, pageOcrText);
      } catch (err) {
        console.warn('이전 단어장 사진 저장 실패:', err);
      }
    }

    // 2) 신규 단어장 설정 및 recency 갱신 (단일 선택 유지)
    setInputBookTitle(trimmedNext);
    setSelectedTargetBooks([trimmedNext]);
    touchBookUsage(trimmedNext);

    // 3) 신규 단어장의 보관된 사진(최대 2장) 및 텍스트 복원
    try {
      const saved = await loadBookSourceData(trimmedNext);
      if (saved && (saved.images.length > 0 || saved.ocrText)) {
        sourceImagesRef.current = saved.images;
        setSourceImages(saved.images);
        const latest = saved.images.length > 0 ? saved.images[saved.images.length - 1] : null;
        currentSourceImageRef.current = latest;
        setCurrentSourceImage(latest);
        setPageOcrText(saved.ocrText || '');
        setLoadedSourceType(saved.images.length > 0 ? 'camera' : (saved.ocrText ? 'web' : null));
        if (typeof window !== 'undefined') {
          if (saved.ocrText) {
            localStorage.setItem('context_vocab_cached_page_ocr', saved.ocrText);
          } else {
            localStorage.removeItem('context_vocab_cached_page_ocr');
          }
        }
      } else {
        // 해당 단어장에 아직 저장된 사진이 없는 경우: 깨끗한 상태로 준비
        sourceImagesRef.current = [];
        setSourceImages([]);
        currentSourceImageRef.current = null;
        setCurrentSourceImage(null);
        setPageOcrText('');
        setLoadedSourceType(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('context_vocab_cached_page_ocr');
        }
      }
    } catch (err) {
      console.warn('단어장 사진 복원 실패:', err);
    }
  }

  // OCR & Web Source State (현재 로드된 페이지/웹문서 텍스트 & 캐시)
  const [pageOcrText, setPageOcrText] = useState<string>('');
  const [lastOcrEngineInfo, setLastOcrEngineInfo] = useState<{
    method: 'gemini_vision' | 'gemini_repair' | 'tesseract' | 'web';
    label: string;
    failureReason?: string;
  } | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrDetectedNotice, setOcrDetectedNotice] = useState<string | null>(null);
  const [ocrTimingStats, setOcrTimingStats] = useState<OcrTimingStats | null>(null);
  const [isOcrTimingExpanded, setIsOcrTimingExpanded] = useState<boolean>(false);
  const [ocrElapsedMs, setOcrElapsedMs] = useState<number>(0);

  useEffect(() => {
    if (!isOcrProcessing) {
      setOcrElapsedMs(0);
      return;
    }
    const start = performance.now();
    const timer = setInterval(() => {
      setOcrElapsedMs(Math.round(performance.now() - start));
    }, 100);
    return () => clearInterval(timer);
  }, [isOcrProcessing]);
  const [detectedCandidateSentences, setDetectedCandidateSentences] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const isAppendModeRef = useRef<boolean>(false);
  const [completingSentenceId, setCompletingSentenceId] = useState<string | null>(null);

  // Background Non-blocking Processing State (백그라운드 분석 및 저장 대기)
  const [isSourceProcessing, setIsSourceProcessing] = useState(false);
  const [sourceProcessTaskName, setSourceProcessTaskName] = useState<string>('');
  const [isSavingAwaitingSource, setIsSavingAwaitingSource] = useState(false);
  const sourceTaskPromiseRef = useRef<Promise<string | null> | null>(null);
  const wordDebounceTimersRef = useRef<{ [entryId: string]: any }>({});

  // Web URL Scraper & Article Paste State (웹페이지 URL 또는 로그인/유료 기사 본문 붙여넣기 통합)
  const [inputSourceText, setInputSourceText] = useState<string>('');
  const [inputWebUrl, setInputWebUrl] = useState<string>('');
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlModalTab, setUrlModalTab] = useState<'url' | 'paste'>('url');
  const [inputPastedText, setInputPastedText] = useState<string>('');
  const [inputPastedTitle, setInputPastedTitle] = useState<string>('');
  const [autoRemoveAds, setAutoRemoveAds] = useState(true);
  const [isCleaningPastedText, setIsCleaningPastedText] = useState(false);
  const [isUrlScraping, setIsUrlScraping] = useState(false);
  const [urlScrapeError, setUrlScrapeError] = useState<string | null>(null);
  const [loadedSourceType, setLoadedSourceType] = useState<'camera' | 'web' | null>(null);
  const [loadedWebTitle, setLoadedWebTitle] = useState<string>('');
  const [currentSourceImage, setCurrentSourceImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const currentSourceImageRef = useRef<{ base64: string; mimeType: string } | null>(null);
  // 이전 사진까지 최대 2장을 보관하여 페이지 넘김/문장 잘림 자동 연결
  const [sourceImages, setSourceImages] = useState<{ base64: string; mimeType: string }[]>([]);
  const sourceImagesRef = useRef<{ base64: string; mimeType: string }[]>([]);

  // Word Selection from Loaded Text State (원문에서 단어 직접 클릭 선택 및 원본 사진 대조)
  const [isWordSelectModalOpen, setIsWordSelectModalOpen] = useState(false);
  const [selectedWordsFromText, setSelectedWordsFromText] = useState<string[]>([]);
  const [pickerTab, setPickerTab] = useState<'text' | 'split' | 'image'>('split');
  const [editingWordIdx, setEditingWordIdx] = useState<number | null>(null);
  const [editingWordVal, setEditingWordVal] = useState<string>('');
  const [manualWordInput, setManualWordInput] = useState<string>('');
  const [isCleaningWithAI, setIsCleaningWithAI] = useState<boolean>(false);
  const selectedWordContextMapRef = useRef<Record<string, string>>({});

  // Filter & Grouping State (복수 단어장 다중 선택 지원)
  const [selectedBookFilters, setSelectedBookFilters] = useState<string[]>(['all']);
  const [isBookSelectorOpen, setIsBookSelectorOpen] = useState<boolean>(false);
  const bookSelectorRef = useRef<HTMLDivElement>(null);

  // Interactive Touch Swipe Gesture between 3 Main Tabs (단어등록 <-> 단어장 <-> 5지선다)
  const TAB_ORDER: ('add' | 'list' | 'quiz')[] = ['add', 'list', 'quiz'];
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const swipeDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
  const currentDeltaXRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const carouselTrackRef = useRef<HTMLDivElement>(null);

  // Sync carousel position when activeTab is changed via button clicks
  useEffect(() => {
    const idx = TAB_ORDER.indexOf(activeTab);
    if (carouselTrackRef.current && !isSwipingRef.current) {
      setIsTransitioning(true);
      carouselTrackRef.current.style.transition = 'transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)';
      carouselTrackRef.current.style.transform = `translateX(-${idx * 100}%)`;
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 340);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'input, textarea, select, button, [data-no-swipe="true"], .overflow-x-auto, [role="slider"], a'
      )
    ) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
    swipeDirectionRef.current = null;
    currentDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const dx = clientX - touchStartXRef.current;
    const dy = clientY - touchStartYRef.current;

    // Detect direction lock on initial movement
    if (swipeDirectionRef.current === null) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
        swipeDirectionRef.current = 'vertical';
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 7) {
        swipeDirectionRef.current = 'horizontal';
        isSwipingRef.current = true;
        setIsSwiping(true);
      }
    }

    if (swipeDirectionRef.current === 'horizontal') {
      const idx = TAB_ORDER.indexOf(activeTab);
      // Elastic resistance when dragging past left/right boundaries
      let effectiveDx = dx;
      if ((idx === 0 && dx > 0) || (idx === 2 && dx < 0)) {
        effectiveDx = dx * 0.25;
      }
      currentDeltaXRef.current = effectiveDx;

      if (carouselTrackRef.current) {
        carouselTrackRef.current.style.transition = 'none';
        carouselTrackRef.current.style.transform = `translateX(calc(-${idx * 100}% + ${effectiveDx}px))`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = currentDeltaXRef.current;
    const elapsed = Date.now() - touchStartTimeRef.current;
    const isHorizontal = swipeDirectionRef.current === 'horizontal';

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    swipeDirectionRef.current = null;
    currentDeltaXRef.current = 0;

    if (!isHorizontal) {
      isSwipingRef.current = false;
      setIsSwiping(false);
      return;
    }

    const idx = TAB_ORDER.indexOf(activeTab);
    const velocity = Math.abs(deltaX) / (elapsed || 1);
    const isFlick = Math.abs(deltaX) > 35 && velocity > 0.3;
    const isSignificantDrag = Math.abs(deltaX) > 60;

    let targetIdx = idx;
    if (deltaX < 0 && (isSignificantDrag || isFlick) && idx < 2) {
      // Dragged Left -> Next tab
      targetIdx = idx + 1;
    } else if (deltaX > 0 && (isSignificantDrag || isFlick) && idx > 0) {
      // Dragged Right -> Prev tab
      targetIdx = idx - 1;
    }

    const targetTab = TAB_ORDER[targetIdx];

    if (carouselTrackRef.current) {
      carouselTrackRef.current.style.transition = 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)';
      carouselTrackRef.current.style.transform = `translateX(-${targetIdx * 100}%)`;
    }

    if (targetTab !== activeTab) {
      if (targetTab === 'quiz' && quizList.length === 0) {
        startQuiz();
      }
      setActiveTab(targetTab);
    }

    setTimeout(() => {
      isSwipingRef.current = false;
      setIsSwiping(false);
    }, 300);
  };

  // 문장 듣기 (연속 낭독) 상태
  const [isListeningSentences, setIsListeningSentences] = useState<boolean>(false);
  const [currentSentencePlayIdx, setCurrentSentencePlayIdx] = useState<number>(-1);
  const cancelSentencePlayRef = useRef<boolean>(false);

  // Live Dictionary Candidates State (아래쪽 결과 영역 리스트용)
  const [liveCandidates, setLiveCandidates] = useState<SuggestionItem[]>([]);

  // Quiz State
  const [quizMode, setQuizMode] = useState<'smart' | 'wrong' | 'recent' | 'all'>('smart');
  const [quizList, setQuizList] = useState<VocabItem[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizAnswerState, setQuizAnswerState] = useState<{
    answered: boolean;
    chosen: string;
    isCorrect: boolean;
  }>({ answered: false, chosen: '', isCorrect: false });
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  // 단어 목록 카드별 문장 번갈아 보기 인덱스 (단어 ID -> 현재 보고 있는 문장 인덱스)
  const [listCardSentenceIdx, setListCardSentenceIdx] = useState<Record<string, number>>({});
  // 단어 목록 카드별 문장 한글 해석 펼침 여부 (단어 ID -> boolean)
  const [showListSentenceTransMap, setShowListSentenceTransMap] = useState<Record<string, boolean>>({});
  // 퀴즈 복습 시 번갈아 가며 출제되는 현재 문맥 문장
  const [quizSentenceIdx, setQuizSentenceIdx] = useState<number>(0);
  const [quizActiveSentence, setQuizActiveSentence] = useState<string>('');
  // 퀴즈 원문 문맥의 한글 해석 펼침 여부 (기본값 false, 새 문제 풀이 시 false로 자동 리셋)
  const [showQuizSentenceTranslation, setShowQuizSentenceTranslation] = useState<boolean>(false);
  // 단어 등록 시 문장 자동 번역 중인 entry id
  const [translatingSentenceId, setTranslatingSentenceId] = useState<string | null>(null);
  // 단어 목록/퀴즈에서 AI 문장 번역 중인 item id
  const [translatingListItemId, setTranslatingListItemId] = useState<string | null>(null);

  // User Authentication & Supabase Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => {
    setCurrentAiUserContext(currentUser);
  }, [currentUser]);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState('https://mkclocmrpxjrowldfryd.supabase.co');
  const [inputSupabaseAnonKey, setInputSupabaseAnonKey] = useState('sb_publishable_J9jsy23QWH9yXeVE5pMxFg_GbC7MlFE');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCopiedSql, setIsCopiedSql] = useState(false);
  const [isSyncingWords, setIsSyncingWords] = useState(false);

  // Email / Password Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'ai' | 'preferences' | 'admin'>('profile');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [ttsVoice, setTtsVoice] = useState('en-US');
  const [ttsRate, setTtsRate] = useState<number>(1.25);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [isServerGeminiReady, setIsServerGeminiReady] = useState(false);
  const [aiUsageStats, setAiUsageStats] = useState<AiUsageStats>(() => getAiUsageStats());

  // Admin Vercel Server API Usage & Management State (Ashstone3@gmail.com)
  const [adminSection, setAdminSection] = useState<'api' | 'notice' | 'db' | 'sandbox' | 'system'>('api');
  const [serverUsageReport, setServerUsageReport] = useState<any | null>(null);
  const [adminSystemInfo, setAdminSystemInfo] = useState<any | null>(null);
  const [isLoadingServerUsage, setIsLoadingServerUsage] = useState<boolean>(false);
  const [isPingTesting, setIsPingTesting] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; durationMs?: number; modelUsed?: string; error?: string } | null>(null);
  const [isAdminActionRunning, setIsAdminActionRunning] = useState<boolean>(false);

  // Global Announcement State
  const [announcement, setAnnouncement] = useState<AppAnnouncement>(() => getStoredAnnouncement());
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);
  const [noticeInputMsg, setNoticeInputMsg] = useState<string>(() => getStoredAnnouncement().message);
  const [noticeInputType, setNoticeInputType] = useState<'info' | 'warning' | 'update'>(() => getStoredAnnouncement().type);
  const [noticeInputActive, setNoticeInputActive] = useState<boolean>(() => getStoredAnnouncement().active);

  // Admin AI Sandbox State
  const [adminSandboxPrompt, setAdminSandboxPrompt] = useState<string>(
    'Explain the nuance of "serendipity" in natural Korean and provide a vivid example sentence in JSON format.'
  );
  const [adminSandboxResult, setAdminSandboxResult] = useState<any | null>(null);
  const [isAdminSandboxRunning, setIsAdminSandboxRunning] = useState<boolean>(false);

  useEffect(() => {
    function handleAnnouncementChange(e: any) {
      if (e?.detail) {
        setAnnouncement(e.detail);
      }
    }
    window.addEventListener(ANNOUNCEMENT_CHANGED_EVENT, handleAnnouncementChange);
    return () => {
      window.removeEventListener(ANNOUNCEMENT_CHANGED_EVENT, handleAnnouncementChange);
    };
  }, []);

  useEffect(() => {
    function handleUsageChange() {
      setAiUsageStats(getAiUsageStats());
    }
    window.addEventListener(AI_USAGE_EVENT, handleUsageChange);
    window.addEventListener('focus', handleUsageChange);
    return () => {
      window.removeEventListener(AI_USAGE_EVENT, handleUsageChange);
      window.removeEventListener('focus', handleUsageChange);
    };
  }, []);

  // Profile & Avatar State (0MB Supabase Storage Quota Strategy)
  const [customAvatar, setCustomAvatarState] = useState<string | null>(null);
  const [customDisplayName, setCustomDisplayNameState] = useState<string>('');
  const [profileInputName, setProfileInputName] = useState<string>('');
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState<string | null>(null);
  const [avatarCompressionInfo, setAvatarCompressionInfo] = useState<{ sizeKb: number } | null>(null);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Admin identity check (case-insensitive)
  const isAdmin = Boolean(currentUser?.email && isUserAdmin(currentUser.email));

  const fetchServerUsage = useCallback(async () => {
    if (!currentUser?.email || !isUserAdmin(currentUser.email)) return;
    setIsLoadingServerUsage(true);
    try {
      const res = await fetch(`/api/admin/usage?email=${encodeURIComponent(currentUser.email)}`, {
        headers: {
          'x-user-email': currentUser.email,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.ok) {
          if (data.report) setServerUsageReport(data.report);
          if (data.systemInfo) setAdminSystemInfo(data.systemInfo);
        }
      }
    } catch (err) {
      console.error('Failed to fetch server usage:', err);
    } finally {
      setIsLoadingServerUsage(false);
    }
  }, [currentUser?.email]);

  async function handlePingServerKey() {
    if (!currentUser?.email || !isUserAdmin(currentUser.email)) return;
    setIsPingTesting(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({ action: 'ping', email: currentUser.email }),
      });
      const data = await res.json();
      setPingResult(data);
      fetchServerUsage();
    } catch (err: any) {
      setPingResult({ ok: false, error: err?.message || '실시간 진단 실패' });
    } finally {
      setIsPingTesting(false);
    }
  }

  async function handleResetServerCounter() {
    if (!confirm('오늘의 서버 API 호출 카운터를 0회로 초기화하시겠습니까?')) return;
    setIsAdminActionRunning(true);
    try {
      const res = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser!.email! },
        body: JSON.stringify({ action: 'reset_counter', email: currentUser!.email }),
      });
      const data = await res.json();
      if (data.ok && data.report) {
        setServerUsageReport(data.report);
        triggerToast('카운터 초기화 완료 🔄', '오늘의 서버 API 호출 카운터가 0으로 리셋되었습니다.');
      }
    } catch (err: any) {
      triggerToast('초기화 실패', err?.message || '카운터 리셋 중 오류 발생');
    } finally {
      setIsAdminActionRunning(false);
    }
  }

  async function handleClearRateLimits() {
    setIsAdminActionRunning(true);
    try {
      const res = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser!.email! },
        body: JSON.stringify({ action: 'clear_rate_limits', email: currentUser!.email }),
      });
      const data = await res.json();
      if (data.ok) {
        triggerToast('접속 제한 해제 완료 ⚡', data.message || '차단된 IP 캐시가 모두 해제되었습니다.');
        fetchServerUsage();
      }
    } catch (err: any) {
      triggerToast('해제 실패', err?.message || 'IP 접속 제한 해제 실패');
    } finally {
      setIsAdminActionRunning(false);
    }
  }

  async function handleClearUsageLogs() {
    if (!confirm('최근 API 호출 기록을 모두 삭제하시겠습니까?')) return;
    setIsAdminActionRunning(true);
    try {
      const res = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser!.email! },
        body: JSON.stringify({ action: 'clear_logs', email: currentUser!.email }),
      });
      const data = await res.json();
      if (data.ok && data.report) {
        setServerUsageReport(data.report);
        triggerToast('로그 정리 완료 🧹', '최근 API 호출 기록이 초기화되었습니다.');
      }
    } catch (err: any) {
      triggerToast('정리 실패', err?.message || '로그 삭제 중 오류 발생');
    } finally {
      setIsAdminActionRunning(false);
    }
  }

  async function handleRunAdminSandbox() {
    if (!adminSandboxPrompt.trim()) return;
    setIsAdminSandboxRunning(true);
    setAdminSandboxResult(null);
    try {
      const res = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser!.email! },
        body: JSON.stringify({
          action: 'test_ai_prompt',
          prompt: adminSandboxPrompt,
          email: currentUser!.email,
        }),
      });
      const data = await res.json();
      setAdminSandboxResult(data);
      fetchServerUsage();
    } catch (err: any) {
      setAdminSandboxResult({ ok: false, error: err?.message || '샌드박스 실행 실패' });
    } finally {
      setIsAdminSandboxRunning(false);
    }
  }

  function handleSaveAnnouncement() {
    const updated: AppAnnouncement = {
      id: `notice-${Date.now()}`,
      active: noticeInputActive,
      type: noticeInputType,
      message: noticeInputMsg.trim(),
      updatedAt: Date.now(),
    };
    saveStoredAnnouncement(updated);
    setAnnouncement(updated);
    setDismissedAnnouncementId(null);
    triggerToast(
      '전역 공지사항 저장됨 📢',
      noticeInputActive ? '화면 상단에 실시간 공지 배너가 게시되었습니다.' : '공지 배너가 비활성화되었습니다.'
    );
  }

  function handleExportAllVocabJson() {
    const allBooks = Array.from(new Set(vocabulary.map((w) => w.bookTitle || '기본 단어장')));
    const exportData = {
      version: 'context_vocab_master_v1',
      exportedAt: new Date().toISOString(),
      adminUser: currentUser?.email || 'admin',
      totalWordCount: vocabulary.length,
      books: allBooks,
      words: vocabulary,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `context_vocab_master_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('전체 마스터 백업 완료 💾', `총 ${vocabulary.length}개 단어가 JSON 파일로 다운로드되었습니다.`);
  }

  async function handleAdminForceResetPresets() {
    if (
      !confirm(
        '⚠️ 정말로 모든 단어를 기본 30개 프리셋 단어로 초기화하시겠습니까?\n기존 사용자가 추가한 단어는 사라지고 3개 기본 책(30단어)으로 클린 리셋됩니다.'
      )
    )
      return;
    setIsAdminActionRunning(true);
    try {
      const resetItems = await resetWithSamples(currentUser?.id);
      setVocabulary(resetItems);
      triggerToast('단어장 클린 리셋 완료 ✨', `기본 3개 책(30개 단어)으로 완벽하게 복구되었습니다.`);
    } catch (err: any) {
      triggerToast('리셋 실패', err?.message || '단어 초기화 실패');
    } finally {
      setIsAdminActionRunning(false);
    }
  }

  useEffect(() => {
    if (isSettingsOpen && isAdmin) {
      fetchServerUsage();
    }
  }, [isSettingsOpen, isAdmin, fetchServerUsage]);

  // Computed User Identity for UI Display
  const effectiveAvatar =
    customAvatar ||
    currentUser?.user_metadata?.custom_avatar ||
    currentUser?.user_metadata?.avatar_url ||
    null;
  const effectiveDisplayName =
    customDisplayName ||
    currentUser?.user_metadata?.full_name ||
    (currentUser?.email ? currentUser.email.split('@')[0] : '게스트 사용자');

  // Open settings with a specific tab
  function openSettingsWithTab(tab: 'profile' | 'ai' | 'preferences' | 'admin') {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }

  // Floating Toast State
  const [toast, setToast] = useState<{ show: boolean; title: string; subtitle?: string } | null>(null);
  const [aiQuotaExceededNotice, setAiQuotaExceededNotice] = useState<AiQuotaExceededInfo | null>(null);

  // 서버 공용 AI 일일 한도 초과 시 자동으로 개인 키 등록 화면(설정 -> AI 연동) 표시
  useEffect(() => {
    setAiQuotaExceededHandler((info) => {
      setAiQuotaExceededNotice(info);
      setIsWordSelectModalOpen(false);
      setSettingsTab('ai');
      setIsSettingsOpen(true);
      triggerToast(
        '오늘의 무료 서버 AI 한도 도달 🔑',
        '개인 무료 Google API 키를 등록하면 일 1,500회 + 비상 100회 바로 이어서 사용할 수 있어요.'
      );
    });
    return () => setAiQuotaExceededHandler(null);
  }, []);

  // 화면 전환 / 앱 백그라운드 복귀 시 퀴즈 및 탭 상태 유지용 Ref
  const initialLoadedRef = useRef(false);
  const lastLoadedUserIdRef = useRef<string | null | undefined>(undefined);

  // 단어장 삭제 모달 상태
  const [isDeleteBookModalOpen, setIsDeleteBookModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<string>('');
  const [deleteBookAction, setDeleteBookAction] = useState<'move' | 'delete_all'>('move');
  const [targetMoveBook, setTargetMoveBook] = useState<string>('');
  const [targetCustomBook, setTargetCustomBook] = useState<string>('');
  const [isTargetCustom, setIsTargetCustom] = useState(false);
  const [isDeletingBook, setIsDeletingBook] = useState(false);

  function triggerToast(title: string, subtitle?: string) {
    setToast({ show: true, title, subtitle });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  // Google Gemini AI Key 저장 및 유효성 테스트
  async function handleSaveAndTestAiKey(keyToSave?: string) {
    const key = (keyToSave || geminiKeyInput).trim();
    if (!key) {
      setStoredGeminiKey('');
      setGeminiApiKey('');
      setKeyTestStatus({ ok: false, message: 'API 키가 비어있습니다. 기본 로컬 모드로 작동합니다.' });
      return;
    }

    setIsTestingKey(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (data.ok) {
        setStoredGeminiKey(key);
        setGeminiApiKey(key);
        setAiQuotaExceededNotice(null);
        recordAiUsage(1);
        setAiUsageStats(getAiUsageStats());
        setKeyTestStatus({ ok: true, message: data.message || 'Google Gemini AI 연동 성공! 🤖 모든 AI 비전 및 문맥 분석 기능이 활성화되었습니다.' });
        triggerToast('AI 연동 완료! 🤖', '책 사진 고정밀 인식 및 복수/시제 변화형 문맥 추출이 활성화되었습니다.');
      } else {
        setKeyTestStatus({ ok: false, message: data.error || 'API 키 검증 실패. 올바른 키인지 확인해 주세요.' });
      }
    } catch {
      setKeyTestStatus({ ok: false, message: '서버 연결에 실패했습니다.' });
    } finally {
      setIsTestingKey(false);
    }
  }

  // Handle client-side avatar file compression
  async function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingAvatar(true);
    try {
      const result = await compressAvatarImage(file, 128, 0.75);
      setPendingAvatarDataUrl(result.dataUrl);
      setAvatarCompressionInfo({ sizeKb: result.sizeKb });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '이미지 압축에 실패했습니다.');
    } finally {
      setIsCompressingAvatar(false);
      e.target.value = '';
    }
  }

  // Handle saving profile changes
  async function handleSaveProfile() {
    setIsSavingProfile(true);
    try {
      const avatarToSave =
        pendingAvatarDataUrl !== null
          ? (pendingAvatarDataUrl || null)
          : customAvatar;

      const res = await updateProfile(currentUser, profileInputName, avatarToSave);
      if (res.success) {
        setCustomDisplayNameState(profileInputName.trim());
        setCustomAvatarState(avatarToSave);
        setPendingAvatarDataUrl(null);
        setAvatarCompressionInfo(null);

        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            user_metadata: {
              ...currentUser.user_metadata,
              full_name: profileInputName.trim(),
              custom_avatar: avatarToSave,
            },
          });
        }

        triggerToast('프로필 저장 완료! 🎉', '표시이름과 프로필 사진이 성공적으로 저장되었습니다.');
      } else {
        alert(res.error || '프로필 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Reset avatar to original Google profile photo
  function handleResetAvatarToGoogle() {
    if (currentUser?.user_metadata?.avatar_url) {
      setPendingAvatarDataUrl(currentUser.user_metadata.avatar_url);
      setAvatarCompressionInfo(null);
    }
  }

  // Remove avatar (revert to initials default)
  function handleRemoveAvatar() {
    setPendingAvatarDataUrl('');
    setAvatarCompressionInfo(null);
  }

  // Load Data
  async function loadData(targetUser?: User | null, isInitial?: boolean) {
    const userToUse = targetUser !== undefined ? targetUser : currentUser;
    const list = await fetchVocabulary(userToUse);
    setVocabulary(list);
    setIsLoaded(true);

    // 오직 첫 페이지 접속 시에만 초기 퀴즈를 셋업하며,
    // 화면 포커스 복귀나 백그라운드 토큰 갱신 시에는 기존 화면(풀던 퀴즈 등)을 절대 리셋하지 않음!
    if (isInitial && !initialLoadedRef.current) {
      initialLoadedRef.current = true;
      if (list.length > 0) {
        setActiveTab('quiz');
        const defaultBook = list[0]?.bookTitle || '원서 첫걸음: 어린 왕자';
        setSelectedBookFilter(defaultBook);
        startQuiz(defaultBook, 'smart', list);
      }
    }
  }

  // Supabase Auth & Init Lifecycle
  useEffect(() => {
    // 이전 단어장 및 최근 단어장 사용 기록 복원
    if (typeof window !== 'undefined') {
      try {
        const storedRecency = localStorage.getItem('context_vocab_book_recency');
        if (storedRecency) {
          setBookUsageMap(JSON.parse(storedRecency));
        }
        const lastBook = localStorage.getItem('context_vocab_last_book_title');
        if (lastBook && !lastBook.includes('햄릿')) {
          setInputBookTitle(lastBook);
        } else if (lastBook?.includes('햄릿')) {
          localStorage.removeItem('context_vocab_last_book_title');
          setInputBookTitle('원서 첫걸음: 어린 왕자');
        }
      } catch (e) {
        console.error(e);
      }
    }

    const ready = checkIsSupabaseConfigured();
    setIsSupabaseReady(ready);

    const config = getStoredSupabaseConfig();
    if (config.url) setInputSupabaseUrl(config.url);
    if (config.anonKey) setInputSupabaseAnonKey(config.anonKey);

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auth') === 'reset' || window.location.hash.includes('type=recovery')) {
        setAuthMode('reset');
        setIsAuthModalOpen(true);
      }
    }

    const client = getSupabaseClient();
    if (client) {
      client.auth.getUser().then(({ data: { user } }) => {
        const u = user ?? null;
        setCurrentUser(u);
        lastLoadedUserIdRef.current = u?.id || null;
        loadData(u, true);
      });

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user ?? null;
        const previousUserId = lastLoadedUserIdRef.current;
        const isUserSwitched = previousUserId !== undefined && previousUserId !== (user?.id || null);
        lastLoadedUserIdRef.current = user?.id || null;

        setCurrentUser(user);

        if (event === 'PASSWORD_RECOVERY') {
          setAuthMode('reset');
          setIsAuthModalOpen(true);
        } else if (event === 'SIGNED_IN' && user) {
          // 화면 포커스 복귀나 백그라운드 토큰 갱신 시에는 기존 화면(퀴즈 등)을 절대 리셋하지 않음!
          // 실제 다른 사용자로 신규 로그인되었을 때만 isInitial: true 적용
          await loadData(user, isUserSwitched);

          // URL 해시(#access_token) 또는 쿼리(?code=) 정돈
          if (typeof window !== 'undefined' && (window.location.hash || window.location.search.includes('code='))) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (event === 'SIGNED_OUT') {
          await loadData(null, isUserSwitched);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      loadData(null, true);
    }
  }, []);

  // Sync custom profile (avatar & display name) when currentUser changes (across all devices)
  useEffect(() => {
    const cloudAvatar = currentUser?.user_metadata?.custom_avatar;
    const localAvatar = getCustomAvatar(currentUser?.id);
    const savedAvatar = cloudAvatar || localAvatar;

    const cloudName = currentUser?.user_metadata?.full_name;
    const localName = getCustomDisplayName(currentUser?.id);
    const savedName = cloudName || localName;

    setCustomAvatarState(savedAvatar);
    setCustomDisplayNameState(savedName || '');

    const initialName =
      savedName ||
      (currentUser?.email ? currentUser.email.split('@')[0] : '');
    setProfileInputName(initialName);
    setPendingAvatarDataUrl(null);
    setAvatarCompressionInfo(null);
  }, [currentUser]);

  // Settings on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('context_vocab_tts_voice');
      if (savedVoice) setTtsVoice(savedVoice);

      const savedRate = localStorage.getItem('context_vocab_tts_rate');
      if (savedRate) {
        const parsed = parseFloat(savedRate);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
          setTtsRate(parsed);
          setTtsPlaybackRate(parsed);
        }
      } else {
        setTtsRate(1.25);
        setTtsPlaybackRate(1.25);
      }

      const lastBook = localStorage.getItem('context_vocab_last_book_title');
      if (lastBook) setInputBookTitle(lastBook);

      const savedPageOcr = localStorage.getItem('context_vocab_cached_page_ocr');
      if (savedPageOcr) {
        const cleaned = cleanOcrText(savedPageOcr);
        setPageOcrText(cleaned);
        if (cleaned !== savedPageOcr) {
          localStorage.setItem('context_vocab_cached_page_ocr', cleaned);
        }
      }

      // 단어장별 최신 사진(최대 2장) 및 OCR 텍스트 복원
      (async () => {
        try {
          const targetBook = (lastBook && !lastBook.includes('햄릿') ? lastBook : '원서 첫걸음: 어린 왕자').trim();
          await migrateLegacySourceData(targetBook);
          const bookData = await loadBookSourceData(targetBook);
          if (bookData && (bookData.images.length > 0 || bookData.ocrText)) {
            sourceImagesRef.current = bookData.images;
            setSourceImages(bookData.images);
            const latest = bookData.images.length > 0 ? bookData.images[bookData.images.length - 1] : null;
            currentSourceImageRef.current = latest;
            setCurrentSourceImage(latest);
            if (bookData.ocrText) {
              const cleaned = cleanOcrText(bookData.ocrText);
              setPageOcrText(cleaned);
              setLoadedSourceType(bookData.images.length > 0 ? 'camera' : 'web');
            }
          }
        } catch (e) {
          console.warn('Initial book source load error:', e);
        }
      })();

      const savedGeminiKey = getStoredGeminiKey();
      if (savedGeminiKey) {
        setGeminiApiKey(savedGeminiKey);
        setGeminiKeyInput(savedGeminiKey);
      }

      // Vercel 서버 전역 GEMINI_API_KEY 활성화 여부 확인
      fetch('/api/ai/test-key')
        .then((res) => res.json())
        .then((data) => {
          if (data?.serverConfigured) {
            setIsServerGeminiReady(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Google Login Click Handler
  async function handleGoogleLoginClick() {
    if (!checkIsSupabaseConfigured()) {
      setIsSupabaseModalOpen(true);
      return;
    }

    setIsLoggingIn(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        alert(`로그인 오류: ${error.message}`);
      }
    } catch (e: any) {
      alert(`로그인 중 문제가 발생했습니다: ${e?.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  }

  // Email / Password Auth Submit Handler
  async function handleEmailAuthSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);

    // 1. 비밀번호 찾기 (재설정 메일 발송)
    if (authMode === 'forgot') {
      if (!authEmail.trim()) {
        setAuthError('비밀번호를 재설정할 이메일 주소를 입력해 주세요.');
        return;
      }
      setIsAuthSubmitting(true);
      try {
        const { error } = await sendPasswordResetEmail(authEmail);
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthSuccessMsg(
            '비밀번호 재설정 링크를 전송했습니다! 이메일 편지함(또는 스팸함)을 확인해 주세요.'
          );
        }
      } catch (err: any) {
        setAuthError(err.message || '이메일 전송 중 오류가 발생했습니다.');
      } finally {
        setIsAuthSubmitting(false);
      }
      return;
    }

    // 2. 새 비밀번호 설정 완료
    if (authMode === 'reset') {
      if (!authPassword) {
        setAuthError('새 비밀번호를 입력해 주세요.');
        return;
      }
      if (authPassword.length < 6) {
        setAuthError('비밀번호는 최소 6자 이상이어야 합니다.');
        return;
      }
      if (authPassword !== authPasswordConfirm) {
        setAuthError('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
      setIsAuthSubmitting(true);
      try {
        const { error } = await updateUserPassword(authPassword);
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthSuccessMsg('비밀번호가 성공적으로 변경되었습니다!');
          triggerToast('비밀번호 변경 완료! 🎉', '새 비밀번호가 적용되었습니다.');
          setTimeout(() => {
            setIsAuthModalOpen(false);
            setAuthMode('login');
            setAuthPassword('');
            setAuthPasswordConfirm('');
            setAuthSuccessMsg(null);
            if (typeof window !== 'undefined' && window.location.search.includes('auth=reset')) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }, 1500);
        }
      } catch (err: any) {
        setAuthError(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
      } finally {
        setIsAuthSubmitting(false);
      }
      return;
    }

    // 3. 로그인 / 회원가입 기본 검증
    if (!authEmail.trim() || !authPassword) {
      setAuthError('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      if (authMode === 'login') {
        const { data, error } = await signInWithEmail(authEmail, authPassword);
        if (error) {
          const msg =
            error.message === 'Invalid login credentials'
              ? '이메일 또는 비밀번호가 일치하지 않습니다.'
              : error.message;
          setAuthError(msg);
          return;
        }
        if (data?.user) {
          setCurrentUser(data.user);
          await syncGuestWordsToUser(data.user.id);
          await loadData(data.user);
          setIsAuthModalOpen(false);
          setAuthEmail('');
          setAuthPassword('');
          triggerToast('로그인 성공! 🎉', `${data.user.email} 계정으로 클라우드에 연결되었습니다.`);
        }
      } else {
        // 회원가입
        if (authPassword !== authPasswordConfirm) {
          setAuthError('비밀번호가 일치하지 않습니다.');
          return;
        }
        if (authPassword.length < 6) {
          setAuthError('비밀번호는 최소 6자 이상이어야 합니다.');
          return;
        }

        const { data, error } = await signUpWithEmail(authEmail, authPassword);
        if (error) {
          setAuthError(error.message);
          return;
        }
        if (data?.user) {
          if (data.session) {
            setCurrentUser(data.user);
            await syncGuestWordsToUser(data.user.id);
            await loadData(data.user);
            setIsAuthModalOpen(false);
            setAuthEmail('');
            setAuthPassword('');
            setAuthPasswordConfirm('');
            triggerToast('회원가입 & 로그인 완료! 🎉', '이제 등록한 단어가 클라우드에 안전하게 보관됩니다.');
          } else {
            setAuthSuccessMsg(
              '회원가입 요청 완료! 인증 메일이 발송되었거나 가입이 처리되었습니다. 로그인 탭에서 로그인해 보세요.'
            );
          }
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || '인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  // Sign Out Handler
  async function handleSignOut() {
    setIsUserMenuOpen(false);
    await signOutUser();
    setCurrentUser(null);
    await loadData(null, true);
  }

  // Supabase Config Save
  function handleSaveSupabaseConfig() {
    const url = inputSupabaseUrl.trim();
    const key = inputSupabaseAnonKey.trim();
    if (!url || !key) {
      alert('Supabase URL과 Anon Key를 모두 입력해 주세요.');
      return;
    }
    setStoredSupabaseConfig(url, key);
    const ready = checkIsSupabaseConfigured();
    setIsSupabaseReady(ready);
    setIsSupabaseModalOpen(false);
    triggerToast(
      'Supabase 연동 정보 저장 완료! ☁️',
      'Google 소셜 로그인 및 개인별 클라우드 격리 저장이 활성화되었습니다.'
    );
    // Reload client
    const client = getSupabaseClient();
    if (client) {
      client.auth.getUser().then(({ data: { user } }) => {
        setCurrentUser(user ?? null);
        loadData(user ?? null);
      });
    }
  }

  // Supabase Disconnect
  function handleDisconnectSupabase() {
    if (!confirm('Supabase 연동을 해제하시겠습니까? 로컬 스토리지 모드로 작동하게 됩니다.')) return;
    setStoredSupabaseConfig('', '');
    setInputSupabaseUrl('');
    setInputSupabaseAnonKey('');
    setIsSupabaseReady(false);
    setCurrentUser(null);
    setIsSupabaseModalOpen(false);
    triggerToast('Supabase 연동 해제됨', '로컬 스토리지 단어장 모드로 전환되었습니다.');
    loadData(null);
  }

  // Sync Guest Words to User
  async function handleSyncWordsToCloud() {
    if (!currentUser) return;
    setIsSyncingWords(true);
    try {
      const count = await syncGuestWordsToUser(currentUser.id);
      triggerToast(
        '클라우드 동기화 완료! ☁️',
        `${count}개의 로컬 단어가 내 계정으로 안전하게 등록되었습니다.`
      );
      await loadData(currentUser);
    } catch {
      alert('동기화 중 오류가 발생했습니다.');
    } finally {
      setIsSyncingWords(false);
      setIsUserMenuOpen(false);
    }
  }

  // Load Samples for User
  async function handleImportSamples() {
    if (!currentUser) return;
    try {
      await loadSamplesForUser(currentUser.id);
      triggerToast('샘플 단어 추가 완료! 📚', '학습용 샘플 5개 단어가 내 계정에 등록되었습니다.');
      await loadData(currentUser);
    } catch {
      alert('샘플 단어 로드 중 오류가 발생했습니다.');
    } finally {
      setIsUserMenuOpen(false);
    }
  }

  // 원문 소스(사진 또는 웹 URL) 백그라운드 비동기 처리 함수
  function startBackgroundSourceAnalysis(
    taskName: string,
    sourceType: 'camera' | 'web',
    processFn: () => Promise<{
      text: string;
      title?: string;
      sourceUrl?: string;
      sentenceCount?: number;
      markedWords?: string[];
      method?: OcrEngineType;
      engineLabel?: string;
      failureReason?: string;
    }>
  ) {
    setIsSourceProcessing(true);
    setSourceProcessTaskName(taskName);

    const taskPromise = (async () => {
      try {
        const result = await processFn();
        setPageOcrText(result.text);
        setLoadedSourceType(sourceType);
        if (sourceType === 'camera' && result.method) {
          setLastOcrEngineInfo({
            method: result.method,
            label: result.engineLabel || (result.method === 'gemini_vision' ? 'Gemini Vision AI' : result.method === 'gemini_repair' ? 'Gemini AI 텍스트 복원' : 'Tesseract (로컬 기본)'),
            failureReason: result.failureReason,
          });
        } else if (sourceType === 'web') {
          setLastOcrEngineInfo({
            method: 'web',
            label: result.title || '웹 기사 본문',
          });
        }
        if (result.title) {
          setLoadedWebTitle(result.title);
        }
        if (result.sourceUrl) {
          // 기본 소스 URL 기억
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('context_vocab_cached_page_ocr', result.text);
        }

        // 1. 기존에 작성 중이던 단어칸들이 있다면 방금 분석 완료된 본문 속 실제 문장으로 자동 연결!
        wordEntries.forEach((entry) => {
          const w = (entry.word || entry.dictResult?.word || '').trim();
          const needsRealSentence = !entry.context || (entry.candidateSentences && entry.candidateSentences.length === 0);
          if (w && needsRealSentence) {
            updateWordEntry(entry.id, { isAnalyzingContext: true });
            findSentenceWithAI(
              result.text,
              w,
              geminiApiKey,
              entry.dictResult?.meanings,
              currentSourceImageRef.current || currentSourceImage
            ).then((matchRes) => {
              if (matchRes.found && matchRes.sentence) {
                const uniqueSentences = Array.from(
                  new Set(
                    matchRes.allMatches
                      .map((m) => m.sentence.trim())
                      .filter((s) => s.length > 5)
                  )
                );
                let bestDef = entry.selectedMeaning;
                let bestPos = entry.selectedPos;
                if (
                  typeof matchRes.bestMeaningIndex === 'number' &&
                  entry.dictResult?.meanings &&
                  matchRes.bestMeaningIndex < entry.dictResult.meanings.length
                ) {
                  bestDef = entry.dictResult.meanings[matchRes.bestMeaningIndex].def;
                  bestPos = entry.dictResult.meanings[matchRes.bestMeaningIndex].pos;
                }
                updateWordEntry(entry.id, {
                  context: matchRes.sentence,
                  sentenceTranslation: matchRes.sentenceTranslation || entry.sentenceTranslation || undefined,
                  foundCandidateSentences: uniqueSentences,
                  candidateSentences: uniqueSentences,
                  selectedMeaning: bestDef || entry.selectedMeaning,
                  selectedPos: bestPos || entry.selectedPos,
                  isAnalyzingContext: false,
                  ocrDetectedNotice:
                    uniqueSentences.length > 1
                      ? `✨ 본문 분석 완료! '${w}'가 쓰인 문장(${uniqueSentences.length}개)과 최적 뜻이 자동 연결되었습니다.`
                      : `✨ 본문 분석 완료! 원문 속 실제 문장이 자동으로 연결되었습니다.`,
                });
                // 💡 문장 매칭 시 함께 반환된 AI 번역이 없는 경우에만 보조 자동 번역 실행
                if (matchRes.sentence && !matchRes.sentenceTranslation) {
                  handleTranslateContextSentence(entry.id, matchRes.sentence, true);
                }
              } else {
                updateWordEntry(entry.id, { isAnalyzingContext: false });
              }
            }).catch(() => {
              updateWordEntry(entry.id, { isAnalyzingContext: false });
            });
          }
        });

        // 2. 사진에서 사용자가 밑줄이나 동그라미 친 단어가 감지되면 단어 등록칸에 자동 등록!
        if (result.markedWords && result.markedWords.length > 0) {
          enrollWordsToForm(result.markedWords);
          triggerToast(
            `📸 밑줄/동그라미 단어 ${result.markedWords.length}개 자동 등록! ✨`,
            `사진 속 '${result.markedWords.join(', ')}' 단어를 감지하여 사전 조회 및 최적 뜻을 자동 선택했습니다!`
          );
        } else {
          triggerToast(
            `${taskName} 완료! ✅`,
            sourceType === 'web'
              ? `"${result.title || '웹 기사'}" 본문 문장들이 준비되었습니다.`
              : `책 페이지 글자 인식이 완료되어 원문 문장이 준비되었습니다.`
          );
        }

        return result.text;
      } catch (err: any) {
        console.error('Source processing error:', err);
        triggerToast('원문 분석 실패 ⚠️', err.message || '텍스트를 읽어오지 못했습니다.');
        return null;
      } finally {
        setIsSourceProcessing(false);
        setIsOcrProcessing(false);
        setIsUrlScraping(false);
      }
    })();

    sourceTaskPromiseRef.current = taskPromise;
    return taskPromise;
  }

  // 잘린 문장 AI 자동 완성 핸들러 (수동 버튼 클릭 시 단일 보정)
  async function handleCompleteSentence(entryId: string, sentence: string, word: string) {
    if (!sentence || !sentence.trim()) return;
    setCompletingSentenceId(entryId);
    try {
      const res = await fetch('/api/ai/complete-sentence', {
        method: 'POST',
        headers: buildAiRequestHeaders(geminiApiKey),
        body: JSON.stringify({ sentence, word }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.completedSentence) {
          updateWordEntry(entryId, {
            context: data.completedSentence,
            sentenceTranslation: data.sentenceTranslation || undefined,
            isTrailingCutOff: false,
            ocrDetectedNotice: '✨ AI가 잘린 문장을 자연스럽게 완성/보정했습니다.',
          });
          if (!data.sentenceTranslation) {
            handleTranslateContextSentence(entryId, data.completedSentence, true);
          }
          triggerToast('문장 완성 완료! ✨', '페이지 경계로 잘려 있던 문맥을 자연스럽게 보정했습니다.');
        }
      } else if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        if (errData?.code === 'SERVER_QUOTA_EXCEEDED') {
          notifyAiQuotaExceeded(errData.error, errData.quotaInfo);
        }
      }
    } catch (err) {
      console.warn('Sentence completion error:', err);
    } finally {
      setCompletingSentenceId(null);
    }
  }

  // 다음 페이지 사진 업로드 시 등록 대기 중이던 잘린 문장과 자동 이어붙이기
  async function stitchSeveredSentenceWithNextPage(
    entryId: string,
    sentence: string,
    word: string,
    nextPageText: string
  ) {
    if (!sentence || !sentence.trim() || !nextPageText || !nextPageText.trim()) return;
    setCompletingSentenceId(entryId);
    try {
      const res = await fetch('/api/ai/complete-sentence', {
        method: 'POST',
        headers: buildAiRequestHeaders(geminiApiKey),
        body: JSON.stringify({
          sentence,
          word,
          nextPageText: nextPageText.slice(0, 800),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.completedSentence) {
          updateWordEntry(entryId, {
            context: data.completedSentence,
            sentenceTranslation: data.sentenceTranslation || undefined,
            isTrailingCutOff: false,
            ocrDetectedNotice: data.didStitchNextPage
              ? '✨ 다음 페이지 첫 문장과 연결되어 완전한 원문 문장으로 복원되었습니다!'
              : '✨ AI가 잘린 문장을 자연스럽게 완성/보정했습니다.',
          });
          if (data.didStitchNextPage) {
            triggerToast(
              '✨ 다음 페이지와 문장 연결 완료!',
              `'${word || '단어'}'의 잘린 문장을 다음 장과 매끄럽게 연결했습니다.`
            );
          } else {
            triggerToast(
              '문장 완성 완료! ✨',
              '페이지 경계로 잘려 있던 문맥을 자연스럽게 보정했습니다.'
            );
          }
        }
      }
    } catch (err) {
      console.warn('Sentence stitch error:', err);
    } finally {
      setCompletingSentenceId(null);
    }
  }

  // OCR 페이지 사진 촬영 / 업로드 핸들러 (백그라운드 비동기 처리 - 블로킹 없음 & 이어붙이기 지원)
  async function handlePagePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    const isAppend = isAppendModeRef.current;
    isAppendModeRef.current = false; // Reset

    setIsOcrProcessing(true);
    setOcrProgress(30);
    setIsOcrTimingExpanded(false);

    triggerToast(
      isAppend ? '연속 페이지 분석 시작! 📄' : '사진 분석 시작! 📸',
      isAppend
        ? '이전 사진과 이번 사진의 전후 관계를 AI가 파악해 잘린 문장을 하나로 연결합니다.'
        : '표/그래프를 제외한 본문 글자와 밑줄/동그라미 친 단어를 감지합니다.'
    );

    startBackgroundSourceAnalysis(
      isAppend ? '연속 페이지(2장) 분석' : '책 사진 분석',
      'camera',
      async () => {
        setOcrProgress(45);
        const imgData = await fileToBase64(file);
        let updatedImages: { base64: string; mimeType: string }[] = [];

        if (imgData.base64) {
          // 새로 촬영/업로드 시 단일 사진으로 초기화, 연속 추가 모드일 때만 이전 사진과 결합
          if (isAppend) {
            const prev = sourceImagesRef.current || [];
            updatedImages = [...prev, imgData].slice(-2);
          } else {
            updatedImages = [imgData];
          }
          sourceImagesRef.current = updatedImages;
          setSourceImages(updatedImages);

          currentSourceImageRef.current = imgData;
          setCurrentSourceImage(imgData);

          try {
            saveBookSourceData(inputBookTitle, updatedImages, pageOcrText);
            sessionStorage.setItem('context_vocab_source_images', JSON.stringify(updatedImages));
            sessionStorage.setItem('context_vocab_source_image', JSON.stringify(imgData));
          } catch {
            // ignore quota limit
          }
        }

        // AI Vision 분석 (단일 사진은 1.5~2초 초고속 처리, 연속 모드는 2장 문맥 연결)
        const ocrRes = await extractTextWithAI(
          file,
          geminiApiKey,
          imgData,
          updatedImages
        );
        setOcrProgress(100);

        if (ocrRes.timing) {
          setOcrTimingStats(ocrRes.timing);
        }

        if (ocrRes.method === 'tesseract') {
          triggerToast(
            '⚠️ Tesseract (로컬 기본) 동작',
            ocrRes.failureReason
              ? `AI 호출 실패 (${ocrRes.failureReason})로 기본 로컬 인식기가 동작했습니다.`
              : 'AI 키 미설정 또는 호출 오류로 기본 로컬 인식기가 동작했습니다.'
          );
        } else if (ocrRes.method === 'gemini_vision') {
          triggerToast(
            '🤖 Gemini Vision AI 인식 완료!',
            '초고정밀 AI 비전으로 오타 없이 본문과 밑줄/동그라미를 감지했습니다.'
          );
        } else {
          triggerToast(
            '✨ Gemini AI 문맥 복원 완료!',
            '로컬 추출 텍스트의 오타와 깨진 글자를 AI가 매끄럽게 교정했습니다.'
          );
        }

        // 현재 단어장별 스토리지에 최신 2장 사진과 추출 텍스트 영구 보관
        saveBookSourceData(inputBookTitle, updatedImages, ocrRes.text);

        // 💡 새 페이지 인식 완료 시, 등록 대기 중이던 단어 카드 중 문장이 잘려 있던 항목들과 다음 페이지 첫 문장 자동 연결!
        if (ocrRes.text && ocrRes.text.trim()) {
          const newText = ocrRes.text.trim();
          const currentEntries = wordEntriesRef.current || [];
          const severed = currentEntries.filter((e) => {
            const ctx = (e.context || '').trim();
            return ctx && (e.isTrailingCutOff || isSentenceCutOff(ctx));
          });

          if (severed.length > 0) {
            severed.forEach((e) => {
              stitchSeveredSentenceWithNextPage(
                e.id,
                e.context,
                e.word || e.dictResult?.word || '',
                newText
              );
            });
          }
        }

        return {
          text: ocrRes.text,
          markedWords: ocrRes.markedWords,
          method: ocrRes.method,
          engineLabel: ocrRes.engineLabel,
          failureReason: ocrRes.failureReason,
        };
      }
    );
  }

  // 스마트 입력 감지: URL인지 기사 본문 텍스트인지 자동 판별
  function detectContentType(raw: string): { type: 'url' | 'text'; cleanUrl?: string } {
    const trimmed = raw.trim();
    if (!trimmed) return { type: 'text' };

    // 줄바꿈이 포함되어 여러 줄로 구성된 경우 무조건 본문 텍스트로 처리
    if (trimmed.includes('\n')) {
      const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        return { type: 'text' };
      }
    }

    // URL 판별: http/https로 시작하거나, www.로 시작하거나, 공백 없는 유효 도메인 경로 형식
    const isHttp = /^https?:\/\/[^\s]+$/i.test(trimmed);
    const isWww = /^www\.[^\s]+\.[a-z]{2,}[^\s]*$/i.test(trimmed);
    const isDomain = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/i.test(trimmed);

    if ((isHttp || isWww || isDomain) && !trimmed.includes(' ') && trimmed.length < 2000) {
      let cleanUrl = trimmed;
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      return { type: 'url', cleanUrl };
    }

    return { type: 'text' };
  }

  // Handle Web Page URL Scraping (백그라운드 비동기 처리 - 블로킹 없음)
  async function handleScrapeUrl(overrideUrl?: unknown) {
    const rawTarget = (typeof overrideUrl === 'string' ? overrideUrl : inputWebUrl).trim();
    if (!rawTarget) {
      setUrlScrapeError('웹페이지 주소(URL)를 입력해 주세요.');
      return;
    }

    // 스마트 감지: 만약 URL 입력창에 본문 글을 넣었을 경우 본문 등록으로 자동 전환!
    const detected = detectContentType(rawTarget);
    if (detected.type === 'text') {
      await handleApplyPastedText(rawTarget);
      return;
    }

    const targetUrl = detected.cleanUrl || rawTarget;

    setUrlScrapeError(null);
    setIsUrlModalOpen(false);
    setInputWebUrl('');

    triggerToast('웹페이지 분석 시작! 🌐', '기사를 읽어오는 동안 단어를 먼저 입력하고 뜻을 고르세요.');

    startBackgroundSourceAnalysis('웹페이지 URL 분석', 'web', async () => {
      setIsUrlScraping(true);
      const res = await fetch('/api/scrape-url', {
        method: 'POST',
        headers: buildAiRequestHeaders(geminiApiKey),
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '웹페이지를 불러오지 못했습니다.');
      }

      return {
        text: data.text,
        title: data.title,
        sourceUrl: data.sourceUrl,
        sentenceCount: data.sentenceCount,
      };
    });
  }

  // Handle Pasted Article Text with AI Ad / Noise Cleaning
  async function handleApplyPastedText(overrideText?: unknown, overrideTitle?: string) {
    const raw = (typeof overrideText === 'string' ? overrideText : inputPastedText).trim();
    if (!raw) {
      alert('붙여넣을 기사 본문 텍스트를 입력해 주세요!');
      return;
    }

    // 스마트 감지: 만약 본문 입력창에 URL을 넣었을 경우 URL 분석으로 자동 전환!
    const detected = detectContentType(raw);
    if (detected.type === 'url' && detected.cleanUrl) {
      await handleScrapeUrl(detected.cleanUrl);
      return;
    }

    setIsCleaningPastedText(true);
    try {
      let cleaned = raw;
      let title = (overrideTitle || inputPastedTitle).trim();
      let removedAdCount = 0;

      if (autoRemoveAds) {
        try {
          const res = await fetch('/api/ai/clean-text', {
            method: 'POST',
            headers: buildAiRequestHeaders(geminiApiKey),
            body: JSON.stringify({ rawText: raw }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.cleanedText) {
              cleaned = data.cleanedText;
              removedAdCount = data.removedCount || 0;
              if (!title && data.title) title = data.title;
            }
          } else if (res.status === 429) {
            const errData = await res.json().catch(() => ({}));
            if (errData?.code === 'SERVER_QUOTA_EXCEEDED') {
              notifyAiQuotaExceeded(errData.error, errData.quotaInfo);
            }
          }
        } catch (apiErr) {
          console.warn('AI clean text fallback:', apiErr);
          const { cleanArticleTextHeuristic } = await import('@/lib/cleanText');
          const resH = cleanArticleTextHeuristic(raw);
          cleaned = resH.cleanedText;
          removedAdCount = resH.removedCount;
        }
      }

      setPageOcrText(cleaned);
      setLoadedSourceType('web');
      setLoadedWebTitle(title || '붙여넣은 기사 본문');
      if (typeof window !== 'undefined') {
        localStorage.setItem('context_vocab_cached_page_ocr', cleaned);
      }

      setIsUrlModalOpen(false);
      setInputPastedText('');
      setInputPastedTitle('');

      triggerToast(
        '기사 본문 등록 완료! 📋',
        removedAdCount > 0
          ? `중간 광고 및 불필요한 문구 약 ${removedAdCount}개를 자동 삭제하고 깨끗한 본문으로 정제했습니다.`
          : '기사 본문이 등록되었습니다. [단어 선택]을 눌러 모르는 단어를 골라보세요!'
      );
    } catch (err: any) {
      console.error(err);
      alert('텍스트 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCleaningPastedText(false);
    }
  }

  // 클립보드 원터치 붙여넣기: URL이면 기사 스크래핑, 본문이면 기사 본문으로 스마트 자동 실행
  async function handleClipboardPasteSmart() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        triggerToast('클립보드 안내 📋', '브라우저 보안으로 인해 입력창에 직접 붙여넣어 주세요.');
        return;
      }

      const clipText = await navigator.clipboard.readText();
      const trimmed = clipText ? clipText.trim() : '';

      if (!trimmed) {
        triggerToast('클립보드가 비어 있습니다', '웹 주소(URL)나 기사 본문을 복사한 후 다시 눌러주세요!');
        return;
      }

      const detected = detectContentType(trimmed);
      if (detected.type === 'url' && detected.cleanUrl) {
        triggerToast('🌐 웹 URL 감지됨!', `${detected.cleanUrl.slice(0, 40)}... 본문을 불러옵니다.`);
        await handleScrapeUrl(detected.cleanUrl);
      } else {
        triggerToast('📄 기사 본문 감지됨!', '복사한 글을 본문 문맥으로 자동 등록합니다.');
        await handleApplyPastedText(trimmed);
      }
      setInputSourceText('');
    } catch (err: any) {
      console.warn('Clipboard read error:', err);
      triggerToast('클립보드 권한 필요', '붙여넣기 허용을 누르시거나 아래 입력창에 직접 붙여넣어 주세요.');
    }
  }

  // URL 및 기사 본문 통합 제출 처리
  async function handleUnifiedSubmit() {
    const raw = (inputSourceText || inputWebUrl || inputPastedText).trim();
    if (!raw) {
      setUrlScrapeError('웹 주소(URL) 또는 기사 본문 텍스트를 입력해 주세요.');
      return;
    }

    setUrlScrapeError(null);
    const detected = detectContentType(raw);
    if (detected.type === 'url' && detected.cleanUrl) {
      await handleScrapeUrl(detected.cleanUrl);
    } else {
      await handleApplyPastedText(raw);
    }
    setInputSourceText('');
    setInputWebUrl('');
    setInputPastedText('');
  }

  // Multi-Word Form Helpers
  function handleAddWordEntry() {
    setWordEntries((prev) => [...prev, createWordEntryItem()]);
  }

  function handleRemoveWordEntry(id: string) {
    if (wordEntries.length <= 1) {
      setWordEntries([createWordEntryItem()]);
      return;
    }
    setWordEntries((prev) => prev.filter((item) => item.id !== id));
  }

  function updateWordEntry(id: string, updates: Partial<WordEntryItem>) {
    setWordEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  async function executeSearchForEntry(entryId: string, targetWord?: string) {
    const entry = wordEntries.find((e) => e.id === entryId);
    const wordToSearch = (targetWord || entry?.word || '').trim();
    if (!wordToSearch) {
      alert('조회할 영어 단어를 입력해 주세요!');
      return;
    }

    // 1. 단어의 원형(Lemma / Base form) 후보 자동 추출 (예: Prices -> price, declined -> decline, growing -> grow, went -> go)
    const lemmaCandidate = extractLemmaCandidate(wordToSearch);

    // 이전 검색 결과 및 문맥 초기화 & 로딩 표시 (표제어는 원형으로 즉시 산뜻하게 반영)
    updateWordEntry(entryId, {
      word: lemmaCandidate,
      isSearchingDict: true,
      isAnalyzingContext: true,
      dictResult: null,
      selectedMeaning: '',
      selectedPos: '',
      ocrDetectedNotice: null,
    });

    try {
      // 2. 영한 사전 조회: 원형(lemmaCandidate)으로 우선 조회 (병렬/캐시 최적화로 0.1~0.2초 초고속 완료)
      let res = await lookupDictionary(lemmaCandidate);
      // 만약 원형 조회 결과가 부족하고 원래 단어가 다른 경우 원래 단어로도 보완
      if ((!res.meanings || res.meanings.length === 0) && lemmaCandidate !== wordToSearch.toLowerCase()) {
        const altRes = await lookupDictionary(wordToSearch);
        if (altRes.meanings && altRes.meanings.length > 0) {
          res = altRes;
        }
      }

      const defaultExample =
        res.exampleSentence || `This is a sample sentence illustrating the word "${lemmaCandidate}".`;

      const validMeanings = (res.meanings || []).filter((m) => isValidMeaningDef(m.def));
      const initialDef = validMeanings.length > 0 ? validMeanings[0].def : '';
      const initialPos = validMeanings.length > 0 ? validMeanings[0].pos : '';

      const hasSourceToMatch = Boolean(
        pageOcrText || currentSourceImageRef.current || currentSourceImage || isSourceProcessing
      );

      // ⚡️ 즉시 사전 결과 화면에 노출 & 로딩 스피너 즉시 해제! (체감 대기시간 0초대 달성)
      updateWordEntry(entryId, {
        word: lemmaCandidate,
        dictResult: {
          ...res,
          meanings: validMeanings,
        },
        selectedMeaning: initialDef,
        selectedPos: initialPos,
        isSearchingDict: false, // 💡 사전 로딩 완료!
        isAnalyzingContext: hasSourceToMatch,
        context: entry?.context || defaultExample,
        candidateSentences: [],
        ocrDetectedNotice: isSourceProcessing
          ? '⏳ 원문 사진 분석 진행 중입니다... 완료되면 사진 속 실제 문장으로 자동 연결됩니다.'
          : pageOcrText
          ? '🤖 문맥 속 문장 및 최적 뜻 분석 중...'
          : null,
      });

      // 3. 만약 현재 촬영/불러온 본문 텍스트가 있다면 비동기(백그라운드)로 문맥 탐색 & AI 최적 뜻 매칭
      if (pageOcrText || currentSourceImageRef.current || currentSourceImage) {
        try {
          // 본문 및 원본 이미지 속 검색: 원본 이미지가 있으면 이미지를 직접 보고 100% 무결점 정밀 판독!
          const activeImage = currentSourceImageRef.current || currentSourceImage;
          const contextHint = selectedWordContextMapRef.current[wordToSearch.toLowerCase()];
          const matchRes = await findSentenceWithAI(
            pageOcrText,
            wordToSearch,
            geminiApiKey,
            res.meanings,
            activeImage,
            contextHint
          );
          if (matchRes.found && matchRes.sentence) {
            const uniqueSentences = Array.from(
              new Set(
                matchRes.allMatches
                  .map((m) => m.sentence.trim())
                  .filter((s) => s.length > 5)
              )
            );

            // AI가 확정한 원형(Lemma)이 있으면 최종 표제어로 확정 (OCR 오타 자동 복원 포함!)
            const finalLemma = (matchRes.lemma || lemmaCandidate).trim().toLowerCase();

            // 만약 OCR 오인식 조각(예: categor -> category, jike -> like, ee -> question)이 복원되었다면 사전 재조회!
            let activeDict = res;
            if (finalLemma && finalLemma !== lemmaCandidate) {
              const refreshed = await lookupDictionary(finalLemma);
              if (refreshed && refreshed.meanings && refreshed.meanings.length > 0) {
                activeDict = refreshed;
              }
            }

            // 💡 품사가 '단어'이거나 비어있는 경우 한국어 문법 어미 규칙으로 정확한 품사(동사/명사/형용사/부사) 자동 보정
            if (activeDict.meanings) {
              activeDict = {
                ...activeDict,
                meanings: activeDict.meanings.map((m) => {
                  let p = (m.pos || '').trim();
                  if (!p || p === '단어' || p === '품사') {
                    if (/(하다|되다|이다|다)$/.test(m.def.trim())) p = '동사';
                    else if (/(한|적인|로운|스런|스러운|의)$/.test(m.def.trim())) p = '형용사';
                    else if (/(하게|히|으로)$/.test(m.def.trim())) p = '부사';
                    else p = '명사';
                  }
                  return { ...m, pos: p };
                }),
              };
            }

            // AI가 문맥을 분석하여 선택해준 최적의 뜻 인덱스 또는 뜻 적용
            let bestIdx = 0;
            if (
              typeof matchRes.bestMeaningIndex === 'number' &&
              matchRes.bestMeaningIndex >= 0 &&
              matchRes.bestMeaningIndex < activeDict.meanings.length
            ) {
              bestIdx = matchRes.bestMeaningIndex;
            }

            let selectedDef =
              matchRes.bestMeaningDef ||
              activeDict.meanings[bestIdx]?.def ||
              initialDef;
            let selectedPos =
              matchRes.bestPos ||
              activeDict.meanings[bestIdx]?.pos ||
              initialPos;

            // 만약 AI가 추천한 뜻이 사전 목록에 없다면 맨 위에 추가하여 선택 가능하게 보장
            if (
              matchRes.bestMeaningDef &&
              isValidMeaningDef(matchRes.bestMeaningDef) &&
              !activeDict.meanings.some((m) => m.def === matchRes.bestMeaningDef)
            ) {
              const cleanExisting = activeDict.meanings.filter((m) => isValidMeaningDef(m.def));
              activeDict = {
                ...activeDict,
                meanings: [
                  { pos: selectedPos || '문맥뜻', def: matchRes.bestMeaningDef },
                  ...cleanExisting,
                ],
              };
            } else if (activeDict.meanings[bestIdx] && isValidMeaningDef(activeDict.meanings[bestIdx].def)) {
              selectedDef = activeDict.meanings[bestIdx].def;
              selectedPos = matchRes.bestPos || activeDict.meanings[bestIdx].pos;
              if (matchRes.bestPos && (!activeDict.meanings[bestIdx].pos || activeDict.meanings[bestIdx].pos === '단어')) {
                activeDict.meanings[bestIdx].pos = matchRes.bestPos;
              }
            }

            // '단어' 방지 최종 보정
            if (!selectedPos || selectedPos === '단어' || selectedPos === '품사') {
              if (/(하다|되다|이다|다)$/.test(selectedDef.trim())) selectedPos = '동사';
              else if (/(한|적인|로운|스런|스러운|의)$/.test(selectedDef.trim())) selectedPos = '형용사';
              else if (/(하게|히|으로)$/.test(selectedDef.trim())) selectedPos = '부사';
              else selectedPos = '명사';
            }

            const isFormChanged = wordToSearch.toLowerCase() !== finalLemma;
            const formChangeMsg = isFormChanged
              ? `(원문 '${wordToSearch}' ➔ 표제어 '${finalLemma}') `
              : '';

            const sourcePrefix = activeImage ? '📸 사진 원본 정밀 판독: ' : '✨ ';
            const noticeText = matchRes.aiExplanation
              ? `${sourcePrefix}${formChangeMsg}${matchRes.aiExplanation}`
              : `${sourcePrefix}${formChangeMsg}원문 문맥에 가장 적절한 뜻('${selectedDef}')이 자동 선택되었습니다!`;

            const matchedFinalSentence = matchRes.sentence || uniqueSentences[0] || '';
            const matchedFinalTranslation = matchRes.sentenceTranslation || '';
            const isCutOff = isSentenceCutOff(matchedFinalSentence);

            updateWordEntry(entryId, {
              word: finalLemma,
              dictResult: activeDict,
              selectedMeaning: selectedDef,
              selectedPos: selectedPos,
              foundCandidateSentences: uniqueSentences,
              candidateSentences: uniqueSentences,
              context: matchedFinalSentence,
              sentenceTranslation: matchedFinalTranslation || undefined,
              ocrDetectedNotice: noticeText,
              isAnalyzingContext: false,
              isTrailingCutOff: isCutOff,
            });

            // 💡 문장 매칭 시 함께 생성된 AI 한글 해석이 없는 경우에만 보조 번역 호출
            if (matchedFinalSentence && !matchedFinalTranslation) {
              handleTranslateContextSentence(entryId, matchedFinalSentence, true);
            }
          } else {
            // 본문에 해당 단어가 없는 경우
            const isFormChanged = wordToSearch.toLowerCase() !== lemmaCandidate;
            const noticeMsg = isFormChanged
              ? `💡 '${wordToSearch}'의 원형 표제어 '${lemmaCandidate}'(으)로 등록되었습니다. (원문 미발견으로 기본 예문 제공)`
              : `⚠️ 현재 본문(사진/기사)에 '${wordToSearch}' 단어가 없어 기본 예문이 입력되었습니다.`;

            updateWordEntry(entryId, {
              context: defaultExample,
              ocrDetectedNotice: noticeMsg,
              isAnalyzingContext: false,
            });

            // 💡 기본 예문 한글 해석 자동 생성
            if (defaultExample) {
              handleTranslateContextSentence(entryId, defaultExample, true);
            }
          }
        } catch (mErr) {
          console.warn('Sentence match error:', mErr);
          updateWordEntry(entryId, { ocrDetectedNotice: null, isAnalyzingContext: false });
        }
      } else {
        updateWordEntry(entryId, { isAnalyzingContext: false });
      }
    } catch (e) {
      console.error(e);
      updateWordEntry(entryId, { isSearchingDict: false, isAnalyzingContext: false });
    }
  }

  function handleSelectCandidateForEntry(entryId: string, word: string) {
    updateWordEntry(entryId, { word });
    executeSearchForEntry(entryId, word);
  }

  // 원문(사진 OCR / 웹 기사) 텍스트를 단어 및 구두점으로 분리하여 인터랙티브 토큰 배열 생성
  const textTokens = useMemo(() => {
    if (!pageOcrText) return [];
    const VALID_TWO_LETTER = new Set([
      'in', 'on', 'at', 'to', 'by', 'of', 'or', 'as', 'is', 'it', 'be', 'do', 'go',
      'up', 'so', 'no', 'if', 'we', 'he', 'me', 'my', 'us', 'an', 'am', 'ox', 'ad',
    ]);
    const OCR_NOISE_TOKENS = new Set(['ss', 'xn', 'ns', 'wr', 'ee', 'aa', 'ag', 'eg', 'sa', 'ow', 'ssn']);

    const tokens: { raw: string; cleanWord?: string; isWord: boolean; contextSnippet?: string }[] = [];
    const regex = /([a-zA-Z]+(?:['’-][a-zA-Z]+)*)|([^a-zA-Z]+)/g;
    let match;
    while ((match = regex.exec(pageOcrText)) !== null) {
      if (match[1]) {
        const raw = match[1];
        const lower = raw.toLowerCase();
        const isNoise =
          OCR_NOISE_TOKENS.has(lower) ||
          (raw.length === 2 && !VALID_TWO_LETTER.has(lower));
        const start = Math.max(0, match.index - 70);
        const end = Math.min(pageOcrText.length, match.index + raw.length + 70);
        const snippet =
          pageOcrText.slice(start, match.index) +
          `[[${raw}]]` +
          pageOcrText.slice(match.index + raw.length, end);

        tokens.push({
          raw,
          cleanWord: lower,
          isWord: raw.length >= 2 && !isNoise,
          contextSnippet: snippet,
        });
      } else if (match[2]) {
        tokens.push({
          raw: match[2],
          isWord: false,
        });
      }
    }
    return tokens;
  }, [pageOcrText]);

  function handleToggleWordFromText(word: string, contextSnippet?: string) {
    const clean = word.toLowerCase().trim();
    if (!clean) return;
    if (contextSnippet) {
      selectedWordContextMapRef.current[clean] = contextSnippet;
    }
    setSelectedWordsFromText((prev) =>
      prev.includes(clean) ? prev.filter((w) => w !== clean) : [...prev, clean]
    );
  }

  // 선택된 단어 직접 수정 시작
  function handleStartEditWord(idx: number, currentWord: string) {
    setEditingWordIdx(idx);
    setEditingWordVal(currentWord);
  }

  // 선택된 단어 직접 수정 완료
  function handleSaveEditWord(idx: number) {
    const trimmed = editingWordVal.trim().toLowerCase();
    if (trimmed) {
      setSelectedWordsFromText((prev) => {
        const next = [...prev];
        next[idx] = trimmed;
        return Array.from(new Set(next));
      });
    }
    setEditingWordIdx(null);
    setEditingWordVal('');
  }

  // 사진/본문 보면서 임의의 단어 직접 입력하여 목록에 추가
  function handleAddManualWord() {
    const trimmed = manualWordInput.trim().toLowerCase();
    if (trimmed && trimmed.length >= 2) {
      setSelectedWordsFromText((prev) => Array.from(new Set([...prev, trimmed])));
      setManualWordInput('');
    }
  }

  // Tesseract로 읽어 깨진 본문을 Gemini AI로 원본 사진 및 문맥에서 초고속 재복원
  async function handleAiCleanPageText() {
    const activeImg = currentSourceImageRef.current || currentSourceImage;
    if ((!activeImg || !activeImg.base64) && !pageOcrText.trim()) {
      alert('복원할 사진이나 본문 텍스트 데이터가 없습니다.');
      return;
    }
    setIsCleaningWithAI(true);
    try {
      const apiKey = geminiApiKey || getStoredGeminiKey();
      let restoredText = '';
      let detectedMarked: string[] = [];

      // 1차: Vision OCR + 서버 측 자동 텍스트 복원 폴백 통합 호출
      try {
        const imgs = sourceImagesRef.current && sourceImagesRef.current.length > 0
          ? sourceImagesRef.current
          : activeImg?.base64
          ? [activeImg]
          : [];

        const res = await fetch('/api/ai/ocr', {
          method: 'POST',
          headers: buildAiRequestHeaders(apiKey),
          body: JSON.stringify({
            base64: activeImg?.base64 || '',
            mimeType: activeImg?.mimeType || 'image/jpeg',
            images: imgs,
            fallbackRawText: pageOcrText,
          }),
        });

        if (res.status === 401) {
          setIsWordSelectModalOpen(false);
          openSettingsWithTab('ai');
          triggerToast('Gemini API 키 설정 필요 🔑', '개인 설정의 AI 연동 탭에서 API 키를 먼저 등록해 주세요.');
          return;
        }

        if (res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          if (errData?.code === 'SERVER_QUOTA_EXCEEDED') {
            notifyAiQuotaExceeded(errData.error, errData.quotaInfo);
            return;
          }
        }

        if (res.ok) {
          const data = await res.json();
          if (data.text && data.text.trim()) {
            restoredText = data.text.trim();
            if (Array.isArray(data.markedWords)) {
              detectedMarked = data.markedWords;
            }
          }
        }
      } catch (ocrErr) {
        console.warn('Primary AI OCR call failed, trying fast text repair:', ocrErr);
      }

      // 2차: 만약 이미지 전송 문제 등으로 1차가 실패했다면, 가벼운 텍스트 전용 AI 문맥 복원(1.5초) 즉시 실행
      if (!restoredText && pageOcrText.trim()) {
        const cleanRes = await fetch('/api/ai/clean-text', {
          method: 'POST',
          headers: buildAiRequestHeaders(apiKey),
          body: JSON.stringify({
            rawText: pageOcrText,
            mode: 'ocr_repair',
          }),
        });

        if (cleanRes.ok) {
          const cleanData = await cleanRes.json();
          if (cleanData.cleanedText && cleanData.cleanedText.trim()) {
            restoredText = cleanData.cleanedText.trim();
          }
        }
      }

      if (restoredText) {
        setPageOcrText(restoredText);
        setLastOcrEngineInfo({ method: 'gemini_repair', label: 'Gemini AI 문맥 복원 (오타 교정됨)' });
        if (typeof window !== 'undefined') {
          localStorage.setItem('context_vocab_cached_page_ocr', restoredText);
        }
        if (detectedMarked.length > 0) {
          setSelectedWordsFromText((prev) => Array.from(new Set([...prev, ...detectedMarked])));
        }
        triggerToast(
          'AI 본문 복원 완료! ✨',
          '깨진 OCR 글자와 오타가 자연스러운 영어 원문 문장으로 깔끔하게 복원되었습니다.'
        );
      } else {
        alert('AI 본문 복원에 실패했습니다. 우측 상단 🤖 버튼을 눌러 Gemini API 연동 상태를 확인해 주세요.');
      }
    } catch (err) {
      console.error('AI clean text error:', err);
      alert('AI 본문 정제 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsCleaningWithAI(false);
    }
  }

  // 단어 목록(배열)을 받아 단어 등록칸에 일괄 추가하고 사전 조회 및 문맥 최적 뜻 분석을 자동 실행하는 공통 함수
  function enrollWordsToForm(wordsToAdd: string[], customTitle?: string) {
    if (!wordsToAdd || wordsToAdd.length === 0) return;

    // 중복 제거 및 유효 영어 단어 필터링
    const uniqueWords = Array.from(
      new Set(
        wordsToAdd
          .map((w) => w.trim().toLowerCase())
          .filter((w) => w.length >= 2)
      )
    );
    if (uniqueWords.length === 0) return;

    const currentMemo = customTitle || (loadedSourceType === 'web' && loadedWebTitle ? loadedWebTitle : '');

    setWordEntries((prev) => {
      const newEntries = [...prev];
      const entriesToSearch: { id: string; word: string }[] = [];
      let startIdx = 0;

      // 만약 첫 번째 단어칸이 아직 비어있다면 거기에 첫 단어를 채움
      if (newEntries.length === 1 && !newEntries[0].word.trim() && !newEntries[0].dictResult) {
        const targetId = newEntries[0].id;
        const rawW = uniqueWords[0];
        const lemma = extractLemmaCandidate(rawW);
        newEntries[0] = {
          ...newEntries[0],
          word: lemma,
          sourceMemo: currentMemo,
          isSearchingDict: true,
          isAnalyzingContext: true,
        };
        entriesToSearch.push({ id: targetId, word: rawW });
        startIdx = 1;
      }

      // 나머지 단어들에 대해 새로운 단어 카드 생성
      for (let i = startIdx; i < uniqueWords.length; i++) {
        const rawW = uniqueWords[i];
        const lemma = extractLemmaCandidate(rawW);
        const item = createWordEntryItem({
          word: lemma,
          sourceMemo: currentMemo,
          isSearchingDict: true,
          isAnalyzingContext: true,
        });
        newEntries.push(item);
        entriesToSearch.push({ id: item.id, word: rawW });
      }

      // 각 단어에 대해 사전 조회 & 문맥 최적 뜻 분석 즉시 실행
      entriesToSearch.forEach(({ id, word }, idx) => {
        setTimeout(() => {
          executeSearchForEntry(id, word);
        }, idx * 100);
      });

      return newEntries;
    });
  }

  function handleApplySelectedWords() {
    if (selectedWordsFromText.length === 0) return;

    const wordsToAdd = [...selectedWordsFromText];
    setIsWordSelectModalOpen(false);
    enrollWordsToForm(wordsToAdd);

    triggerToast(
      '단어 선택 완료! ✨',
      `${wordsToAdd.length}개 단어의 사전 뜻과 문맥에 맞는 최적의 뜻을 AI가 자동 선택합니다.`
    );
  }

  // 문장 한글 번역 확보 헬퍼 (저장 시 기본 누락 방지)
  async function resolveSentenceTranslation(sentence: string, existing?: string): Promise<string | undefined> {
    const trimmed = existing?.trim();
    if (trimmed) return trimmed;
    const cleanSent = sentence.trim();
    if (!cleanSent || cleanSent.length < 5) return undefined;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: buildAiRequestHeaders(geminiApiKey),
        body: JSON.stringify({ text: cleanSent }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation?.trim()) {
          return data.translation.trim();
        }
      }
    } catch (e) {
      console.warn('Auto translate on save fallback error:', e);
    }
    return undefined;
  }

  // Save All Words to Vocabulary
  async function handleSaveAllWords() {
    if (!currentUser) {
      alert('단어를 내 단어장에 등록하고 저장하려면 먼저 로그인이 필요합니다.');
      setIsAuthModalOpen(true);
      return;
    }

    const validEntries = wordEntries.filter(
      (e) => (e.dictResult?.word || e.word.trim()) && isValidMeaningDef(e.selectedMeaning)
    );

    if (validEntries.length === 0) {
      alert('저장할 단어의 올바른 한국어 뜻을 먼저 선택하거나 직접 입력해 주세요!');
      return;
    }

    const targetBooks =
      selectedTargetBooks.length > 0
        ? selectedTargetBooks
        : [inputBookTitle.trim() || '기본 단어장'];

    // 💡 문장 한글 해석이 비어있는 경우 저장 직전 자동 번역 확보
    const entriesWithTranslations = await Promise.all(
      validEntries.map(async (entry) => {
        const finalWord = entry.dictResult?.word || entry.word.trim();
        const matchedContext =
          entry.context.trim() || `This sentence illustrates the word ${finalWord}.`;
        const translation = await resolveSentenceTranslation(matchedContext, entry.sentenceTranslation);
        return {
          entry,
          finalWord,
          matchedContext,
          sentenceTranslation: translation,
        };
      })
    );

    await Promise.all(
      targetBooks.flatMap((bookToSave) =>
        entriesWithTranslations.map(({ entry, finalWord, matchedContext, sentenceTranslation }, idx) => {
          const finalCandidates =
            entry.candidateSentences.length > 0
              ? Array.from(new Set([matchedContext, ...entry.candidateSentences]))
              : [matchedContext];

          const newItem: VocabItem = {
            id: `${currentUser?.id ? currentUser.id + '_' : ''}vocab_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            word: finalWord,
            phonetic: entry.dictResult?.phonetic || '',
            partOfSpeech: entry.selectedPos || '단어',
            selectedMeaning: entry.selectedMeaning,
            allMeanings: entry.dictResult ? entry.dictResult.meanings.map((m) => m.def) : [entry.selectedMeaning],
            contextSentence: matchedContext,
            sentenceTranslation: sentenceTranslation || undefined,
            candidateSentences: finalCandidates,
            sourceMemo: entry.sourceMemo.trim() || (loadedWebTitle ? loadedWebTitle : '원서 메모'),
            bookTitle: bookToSave,
            quizCount: 0,
            correctCount: 0,
            wrongCount: 0,
            consecutiveCorrect: 0,
            date: new Date().toISOString().slice(0, 10),
            user_id: currentUser?.id,
          };

          return saveOrMergeVocabularyItem(newItem, currentUser?.id);
        })
      )
    );

    await loadData(currentUser);

    targetBooks.forEach((b) => touchBookUsage(b));

    // Reset Form to 1 empty entry, but keep pageOcrText and loaded sources!
    setWordEntries([createWordEntryItem()]);
    setIsCustomBook(false);
    setCustomBookInput('');

    fireConfetti({ particleCount: 90, spread: 75, origin: { x: 0.35, y: 0.55 } });
    setTimeout(() => {
      fireConfetti({ particleCount: 90, spread: 75, origin: { x: 0.65, y: 0.55 } });
    }, 200);

    const bookSummary =
      targetBooks.length > 1
        ? `${targetBooks[0]} 외 ${targetBooks.length - 1}개 (${targetBooks.length}개 단어장 동시 저장)`
        : targetBooks[0];

    triggerToast(
      validEntries.length > 1
        ? `${validEntries.length}개 단어 저장/문맥 추가 완료! 🎉`
        : `'${validEntries[0].word}' 저장/문맥 추가 완료! 🎉`,
      `[${bookSummary}] 단어장에 반영되었습니다. 이미 등록된 단어는 새로운 원문 문장이 차곡차곡 누적됩니다.`
    );
  }

  // Save Single Word Entry to Vocabulary (신규 등록 및 기존 단어 문맥 누적 병합 지원)
  async function handleSaveSingleWordEntry(entryId: string) {
    if (!currentUser) {
      alert('단어를 내 단어장에 등록하고 저장하려면 먼저 로그인이 필요합니다.');
      setIsAuthModalOpen(true);
      return;
    }

    const entry = wordEntries.find((e) => e.id === entryId);
    if (!entry) return;

    const finalWord = (entry.dictResult?.word || entry.word || '').trim();
    if (!finalWord) {
      alert('저장할 단어를 먼저 입력하거나 선택해 주세요!');
      return;
    }

    // 한국어 뜻 확인: 선택된 뜻이 유효하지 않으면 첫 번째 유효 사전 뜻 자동 채택
    let selectedDef = entry.selectedMeaning;
    let selectedPos = entry.selectedPos;
    if (!isValidMeaningDef(selectedDef)) {
      const valid = (entry.dictResult?.meanings || []).filter((m) => isValidMeaningDef(m.def));
      if (valid.length > 0) {
        selectedDef = valid[0].def;
        selectedPos = valid[0].pos;
      } else {
        alert(`'${finalWord}'의 올바른 한국어 뜻을 먼저 직접 입력하거나 선택해 주세요!`);
        return;
      }
    }

    const targetBooks =
      selectedTargetBooks.length > 0
        ? selectedTargetBooks
        : [inputBookTitle.trim() || '기본 단어장'];

    const matchedContext =
      entry.context.trim() || `This sentence illustrates the word ${finalWord}.`;
    const finalCandidates =
      entry.candidateSentences.length > 0
        ? Array.from(new Set([matchedContext, ...entry.candidateSentences]))
        : [matchedContext];

    // 💡 문장 한글 해석 자동 확보
    const sentenceTranslation = await resolveSentenceTranslation(matchedContext, entry.sentenceTranslation);

    let anyMerged = false;
    let totalSentencesCount = 1;

    for (const bookToSave of targetBooks) {
      const newItem: VocabItem = {
        id: `${currentUser?.id ? currentUser.id + '_' : ''}vocab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        word: finalWord,
        phonetic: entry.dictResult?.phonetic || '',
        partOfSpeech: selectedPos || '단어',
        selectedMeaning: selectedDef,
        allMeanings: entry.dictResult ? entry.dictResult.meanings.map((m) => m.def) : [selectedDef],
        contextSentence: matchedContext,
        sentenceTranslation: sentenceTranslation || undefined,
        candidateSentences: finalCandidates,
        sourceMemo: entry.sourceMemo.trim() || (loadedWebTitle ? loadedWebTitle : '원서 메모'),
        bookTitle: bookToSave,
        quizCount: 0,
        correctCount: 0,
        wrongCount: 0,
        consecutiveCorrect: 0,
        date: new Date().toISOString().slice(0, 10),
        user_id: currentUser?.id,
      };

      const saveResult = await saveOrMergeVocabularyItem(newItem, currentUser?.id);
      if (saveResult.isMerged) anyMerged = true;
      totalSentencesCount = saveResult.totalSentences;
      touchBookUsage(bookToSave);
    }

    await loadData(currentUser);

    // 단어 저장 후 해당 카드 정리:
    // 여러 카드 작성 중인 경우 -> 저장된 카드는 제거
    // 1개만 있던 경우 -> 해당 카드를 빈 칸으로 리셋
    if (wordEntries.length > 1) {
      setWordEntries((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      setWordEntries([createWordEntryItem()]);
    }

    fireConfetti({ particleCount: 75, spread: 65, origin: { x: 0.5, y: 0.55 } });
    const bookSummary =
      targetBooks.length > 1
        ? `${targetBooks[0]} 외 ${targetBooks.length - 1}개 (${targetBooks.length}개 단어장)`
        : targetBooks[0];

    if (anyMerged) {
      triggerToast(
        `'${finalWord}' 새 문맥 추가 완료! 📚`,
        `[${bookSummary}] 단어장에 새로운 원문 문장이 누적되었습니다. (총 ${totalSentencesCount}개 문장 수집됨)`
      );
    } else {
      triggerToast(
        `'${finalWord}' 단어 저장 완료! 🎉`,
        `[${bookSummary}] 단어장에 성공적으로 추가되었습니다.`
      );
    }
  }

  // Delete Item
  async function handleDeleteWord(id: string) {
    if (!currentUser) {
      alert('단어를 삭제하려면 먼저 로그인이 필요합니다.');
      setIsAuthModalOpen(true);
      return;
    }
    if (!confirm('이 단어를 단어장에서 삭제할까요?')) return;
    await deleteVocabularyItem(id, currentUser?.id);
    await loadData(currentUser);
  }

  // 문장 한글 자동 번역 (단어 등록 탭 - 기본 자동 실행)
  async function handleTranslateContextSentence(entryId: string, sentence: string, isSilent = false) {
    const textToTranslate = sentence.trim();
    if (!textToTranslate || textToTranslate.length < 3) return;

    setTranslatingSentenceId(entryId);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          updateWordEntry(entryId, { sentenceTranslation: data.translation });
        }
      } else if (!isSilent) {
        alert('문장 번역을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (e) {
      if (!isSilent) console.warn('Translate error:', e);
    } finally {
      setTranslatingSentenceId(null);
    }
  }

  // 단어장 목록에서 원문 문장 AI 자동 번역 및 저장
  async function handleAutoTranslateAndSaveListItem(itemId: string, sentence: string) {
    const textToTranslate = sentence.trim();
    if (!textToTranslate) return;

    setTranslatingListItemId(itemId);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          await updateVocabularySentenceTranslation(itemId, data.translation, currentUser?.id);
          setVocabulary((prev) =>
            prev.map((v) => (v.id === itemId ? { ...v, sentenceTranslation: data.translation } : v))
          );
        }
      }
    } catch (e) {
      console.warn('Auto translate item error:', e);
    } finally {
      setTranslatingListItemId(null);
    }
  }

  // 퀴즈 화면에서 원문 문장 AI 자동 번역 및 저장
  async function handleAutoTranslateQuizItem(itemId: string, sentence: string) {
    const textToTranslate = sentence.trim();
    if (!textToTranslate) return;

    setTranslatingListItemId(itemId);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          await updateVocabularySentenceTranslation(itemId, data.translation, currentUser?.id);
          setVocabulary((prev) =>
            prev.map((v) => (v.id === itemId ? { ...v, sentenceTranslation: data.translation } : v))
          );
          setQuizList((prev) =>
            prev.map((v) => (v.id === itemId ? { ...v, sentenceTranslation: data.translation } : v))
          );
        }
      }
    } catch (e) {
      console.warn('Auto translate quiz item error:', e);
    } finally {
      setTranslatingListItemId(null);
    }
  }

  // TTS 재생 속도 변경
  function handleTtsRateChange(newRate: number) {
    const rate = Math.round(newRate * 100) / 100;
    setTtsRate(rate);
    setTtsPlaybackRate(rate);
  }

  // Open Delete Book Modal
  function handleOpenDeleteBookModal(title: string) {
    if (!title || title === 'all') return;
    if (!currentUser) {
      alert('단어장을 삭제하려면 먼저 로그인이 필요합니다.');
      setIsAuthModalOpen(true);
      return;
    }
    setBookToDelete(title);
    setDeleteBookAction('move');
    const others = availableBookTitles.filter((t) => t !== title);
    if (others.length > 0) {
      setTargetMoveBook(others[0]);
      setIsTargetCustom(false);
    } else {
      setTargetMoveBook('기본 단어장');
      setIsTargetCustom(false);
    }
    setTargetCustomBook('');
    setIsDeleteBookModalOpen(true);
  }

  // Confirm Delete Book (Move words or Delete together)
  async function handleConfirmDeleteBook() {
    if (!bookToDelete) return;
    const wordsInBook = vocabulary.filter(
      (v) => (v.bookTitle || '기본 단어장') === bookToDelete
    );
    const count = wordsInBook.length;

    setIsDeletingBook(true);
    try {
      if (count === 0) {
        // 단어가 없는 단어장: 메타데이터 및 사용 기록 정리
        const nextBookUsage = { ...bookUsageMap };
        delete nextBookUsage[bookToDelete];
        setBookUsageMap(nextBookUsage);
        if (typeof window !== 'undefined') {
          localStorage.setItem('context_vocab_book_recency', JSON.stringify(nextBookUsage));
        }
        if (inputBookTitle === bookToDelete) {
          const remaining = availableBookTitles.filter((t) => t !== bookToDelete);
          const nextInput = remaining[0] || '기본 단어장';
          setInputBookTitle(nextInput);
          if (typeof window !== 'undefined') {
            localStorage.setItem('context_vocab_last_book_title', nextInput);
          }
        }
        if (selectedBookFilter === bookToDelete) {
          setSelectedBookFilter('all');
        }
        triggerToast('단어장 삭제 완료 🗑️', `'${bookToDelete}' 단어장이 삭제되었습니다.`);
      } else if (deleteBookAction === 'move') {
        const finalTarget = (isTargetCustom ? targetCustomBook : targetMoveBook).trim();
        if (!finalTarget) {
          alert('단어를 옮길 대상 단어장을 선택하거나 이름을 입력해 주세요.');
          setIsDeletingBook(false);
          return;
        }
        if (finalTarget === bookToDelete) {
          alert('현재 삭제하려는 단어장과 다른 대상 단어장을 선택해 주세요.');
          setIsDeletingBook(false);
          return;
        }

        await moveWordsToAnotherBook(bookToDelete, finalTarget, currentUser?.id);

        // 사용 기록 정리 및 타겟 단어장 touch
        const nextBookUsage = { ...bookUsageMap };
        delete nextBookUsage[bookToDelete];
        nextBookUsage[finalTarget] = Date.now();
        setBookUsageMap(nextBookUsage);
        if (typeof window !== 'undefined') {
          localStorage.setItem('context_vocab_book_recency', JSON.stringify(nextBookUsage));
          localStorage.setItem('context_vocab_last_book_title', finalTarget);
        }

        if (inputBookTitle === bookToDelete) {
          setInputBookTitle(finalTarget);
        }

        await loadData(currentUser);
        setSelectedBookFilter(finalTarget);
        triggerToast(
          '단어 이동 & 단어장 삭제 완료! 📦',
          `'${bookToDelete}'의 단어 ${count}개를 '${finalTarget}'(으)로 모두 이동하고 단어장을 삭제했습니다.`
        );
      } else {
        // delete_all: 단어와 단어장 함께 모두 삭제
        await deleteWordsByBook(bookToDelete, currentUser?.id);

        const nextBookUsage = { ...bookUsageMap };
        delete nextBookUsage[bookToDelete];
        setBookUsageMap(nextBookUsage);
        if (typeof window !== 'undefined') {
          localStorage.setItem('context_vocab_book_recency', JSON.stringify(nextBookUsage));
        }

        if (inputBookTitle === bookToDelete) {
          const remaining = availableBookTitles.filter((t) => t !== bookToDelete);
          const nextInput = remaining[0] || '기본 단어장';
          setInputBookTitle(nextInput);
          if (typeof window !== 'undefined') {
            localStorage.setItem('context_vocab_last_book_title', nextInput);
          }
        }

        await loadData(currentUser);
        setSelectedBookFilter('all');
        triggerToast(
          '단어장 및 단어 삭제 완료 🗑️',
          `'${bookToDelete}' 단어장과 수록 단어 ${count}개가 영구 삭제되었습니다.`
        );
      }
      setIsDeleteBookModalOpen(false);
    } catch (e) {
      console.error('단어장 삭제 실패:', e);
      alert('단어장 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingBook(false);
    }
  }

  // 퀴즈 출제 우선순위 점수 계산 함수 (망각 곡선 + 오답률 + 최근 등록 보너스 - 연속 정답 감점)
  function calculateQuizPriority(item: VocabItem): number {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // 1. 오답 횟수 (틀렸던 단어일수록 가중치 대폭 증가)
    const wrongCount = item.wrongCount ?? Math.max(0, (item.quizCount || 0) - (item.correctCount || 0));
    const wrongScore = wrongCount * 3.5;

    // 2. 경과 일수 (망각 주기 계산 - 오랫동안 안 본 단어일수록 점수 증가)
    let daysSinceQuiz = 7;
    if (item.lastQuizDate) {
      const lastDate = new Date(item.lastQuizDate);
      const diffTime = Math.abs(now.getTime() - lastDate.getTime());
      daysSinceQuiz = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } else {
      const regDate = new Date(item.date || todayStr);
      const diffTime = Math.abs(now.getTime() - regDate.getTime());
      daysSinceQuiz = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 2;
    }
    const spacedScore = Math.min(daysSinceQuiz * 1.5, 10);

    // 3. 신규 등록 보너스 (최근 2일 이내 등록 단어)
    let recencyBonus = 0;
    if (item.date) {
      const regDate = new Date(item.date);
      const diffDays = Math.floor(Math.abs(now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) recencyBonus = 4;
    }

    // 4. 연속 정답 감점 (연속으로 맞출수록 이미 아는 단어이므로 출제 빈도 감소)
    const consecutive =
      item.consecutiveCorrect ??
      (item.correctCount && item.correctCount === item.quizCount ? item.correctCount : 0);
    const masteryPenalty = Math.min(consecutive * 2, 8);

    // 자연스러운 랜덤 지터(0~1.5)
    return wrongScore + spacedScore + recencyBonus - masteryPenalty + Math.random() * 1.5;
  }

  // Quiz Logic (다중 단어장 선택 퀴즈 지원)
  function startQuiz(
    targetBook?: string | string[],
    mode?: 'smart' | 'wrong' | 'recent' | 'all',
    customPool?: VocabItem[]
  ) {
    // 연속 문장 듣기 중이었다면 안전하게 즉시 중지
    if (isListeningSentences) {
      cancelSentencePlayRef.current = true;
      stopTTS();
      setIsListeningSentences(false);
      setCurrentSentencePlayIdx(-1);
    }

    let targetFilters: string[];
    if (targetBook) {
      if (Array.isArray(targetBook)) {
        targetFilters = targetBook;
        setSelectedBookFilters(targetBook);
      } else if (targetBook === 'all') {
        targetFilters = ['all'];
        setSelectedBookFilters(['all']);
      } else {
        targetFilters = [targetBook];
        setSelectedBookFilters([targetBook]);
      }
    } else {
      targetFilters = selectedBookFilters;
    }

    const currentMode = mode || quizMode;
    setQuizMode(currentMode);

    let pool = customPool && customPool.length > 0 ? customPool : vocabulary;

    const isAll =
      targetFilters.includes('all') ||
      targetFilters.length === 0 ||
      (availableBookTitles.length > 0 && targetFilters.length === availableBookTitles.length);

    if (!isAll) {
      const filtered = pool.filter((v) => targetFilters.includes(v.bookTitle || '기본 단어장'));
      if (filtered.length > 0) {
        pool = filtered;
      }
    }


    if (pool.length === 0) {
      alert('퀴즈를 풀기 전에 먼저 단어를 등록해 주세요!');
      setActiveTab('add');
      return;
    }

    let selectedList: VocabItem[] = [];

    if (currentMode === 'wrong') {
      // 1) 오답 격파 모드: 틀린 적이 있는 단어 우선
      const wrongItems = pool.filter((item) => {
        const wCount = item.wrongCount ?? Math.max(0, (item.quizCount || 0) - (item.correctCount || 0));
        return wCount > 0;
      });

      if (wrongItems.length > 0) {
        selectedList = [...wrongItems].sort((a, b) => {
          const wA = a.wrongCount ?? ((a.quizCount || 0) - (a.correctCount || 0));
          const wB = b.wrongCount ?? ((b.quizCount || 0) - (b.correctCount || 0));
          return wB - wA;
        });
      } else {
        triggerToast('오답 단어가 없습니다! 🎉', '틀렸던 단어가 없어 스마트 복습 모드로 진행합니다.');
        selectedList = [...pool].sort((a, b) => calculateQuizPriority(b) - calculateQuizPriority(a));
      }
    } else if (currentMode === 'recent') {
      // 2) 최근 단어 모드: 최근 등록 순
      selectedList = [...pool].sort((a, b) => {
        const dateA = new Date(a.date || '2000-01-01').getTime();
        const dateB = new Date(b.date || '2000-01-01').getTime();
        return dateB - dateA;
      });
    } else if (currentMode === 'all') {
      // 3) 전체 랜덤 모드
      selectedList = [...pool].sort(() => 0.5 - Math.random());
    } else {
      // 4) 스마트 추천 복습 (기본값): 오답 가중치 + 망각 곡선 주기 + 신규 보너스
      selectedList = [...pool].sort((a, b) => calculateQuizPriority(b) - calculateQuizPriority(a));
    }

    // 5지선다 퀴즈 문제 수 제한 적용 (기본값 20문제, 0은 단어장 전체)
    const limit = quizQuestionCount > 0 ? quizQuestionCount : selectedList.length;
    const finalQuizList = selectedList.slice(0, limit);

    setQuizList(finalQuizList);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setIsQuizFinished(false);
    setActiveTab('quiz');
    setupQuestion(0, finalQuizList, customPool);
  }

  function setupQuestion(index: number, list: VocabItem[], customPool?: VocabItem[]) {
    if (index >= list.length) {
      setIsQuizFinished(true);
      fireConfetti({ particleCount: 120, origin: { x: 0.5, y: 0.5 } });
      setTimeout(() => {
        fireConfetti({ particleCount: 100, origin: { x: 0.3, y: 0.5 } });
        fireConfetti({ particleCount: 100, origin: { x: 0.7, y: 0.5 } });
      }, 300);
      return;
    }
    const current = list[index];
    setQuizAnswerState({ answered: false, chosen: '', isCorrect: false });
    setShowQuizSentenceTranslation(false);

    // 단어에 수집된 문장들 중 무작위/번갈아 가며 출제 문맥으로 선정
    const allSentences = (
      current.candidateSentences && current.candidateSentences.length > 0
        ? current.candidateSentences
        : [current.contextSentence]
    ).filter(Boolean);
    const pickedIdx = Math.floor(Math.random() * allSentences.length);
    setQuizSentenceIdx(pickedIdx);
    const chosenSentence = allSentences[pickedIdx] || current.contextSentence;
    setQuizActiveSentence(chosenSentence);

    // [음성 사전 준비] 문제가 뜨는 순간 원문 문장과 단어를 백그라운드에서 즉시 프리로드 (0ms 즉각 재생)
    if (chosenSentence) {
      preloadSentenceTTS(chosenSentence, ttsVoice);
    }
    if (current.word) {
      preloadWordTTS(current.word, ttsVoice);
    }
    // 번갈아 보기용 후보 문장들도 함께 백그라운드 프리로드
    allSentences.forEach((s) => {
      if (s && s !== chosenSentence) {
        preloadSentenceTTS(s, ttsVoice);
      }
    });
    // 다음 문제 문장도 미리 백그라운드에서 준비
    if (index + 1 < list.length) {
      const nextItem = list[index + 1];
      const nextSentence = nextItem.candidateSentences?.[0] || nextItem.contextSentence;
      if (nextSentence) {
        preloadSentenceTTS(nextSentence, ttsVoice);
      }
    }

    // Options: 1 correct + 4 distractors (다른 단어장 뜻을 우선 교차 배치하여 헷갈리게 구성)
    const correct = current.selectedMeaning;
    const opts = [correct];

    const currentBook = current.bookTitle || '기본 단어장';
    const vocabPool = customPool && customPool.length > 0 ? customPool : vocabulary;

    // 1순위: '다른 단어장(책/레포트)'에 등록된 단어들의 뜻을 우선 선별 (헷갈리는 매력적인 오답)
    const otherBookMeanings = vocabPool
      .filter((v) => (v.bookTitle || '기본 단어장') !== currentBook && v.word !== current.word)
      .map((v) => v.selectedMeaning);
    const shuffledOtherBooks = [...otherBookMeanings].sort(() => 0.5 - Math.random());
    for (const m of shuffledOtherBooks) {
      if (!opts.includes(m) && opts.length < 5) opts.push(m);
    }

    // 2순위: 같은 단어장 내의 다른 단어 뜻 선별
    const sameBookMeanings = vocabPool
      .filter((v) => (v.bookTitle || '기본 단어장') === currentBook && v.word !== current.word)
      .map((v) => v.selectedMeaning);
    const shuffledSameBook = [...sameBookMeanings].sort(() => 0.5 - Math.random());
    for (const m of shuffledSameBook) {
      if (!opts.includes(m) && opts.length < 5) opts.push(m);
    }

    // 3순위: 선지가 5개 미만인 경우 내장 오답 풀에서 정밀 보충
    const shuffledDistractors = [...DISTRACTOR_POOL_KOREAN].sort(() => 0.5 - Math.random());
    for (const d of shuffledDistractors) {
      if (!opts.includes(d) && opts.length < 5) opts.push(d);
    }

    setQuizOptions(opts.sort(() => 0.5 - Math.random()));
  }

  async function handleSelectOption(chosen: string) {
    if (quizAnswerState.answered) return;
    const current = quizList[currentQuizIndex];
    const isCorrect = chosen === current.selectedMeaning;

    // 1. 즉각적인 UI 반응 및 0ms 폭죽 발사 (네트워크 I/O 지연 완전 제거)
    if (isCorrect) {
      fireConfetti({ particleCount: 65, spread: 70, origin: { x: 0.5, y: 0.55 } });
      setQuizScore((prev) => prev + 1);
    }
    setQuizAnswerState({ answered: true, chosen, isCorrect });

    // 2. 문장 카드가 화면에 뜨자마자 미리 준비된 원어민 고음질 음성 즉각 낭독 시작 (지연 0ms)
    const textToRead = quizActiveSentence?.trim() || current.contextSentence?.trim() || current.word;
    speakSentenceTTS(textToRead, ttsVoice);

    // 3. 로컬 상태 즉각 동기화
    const todayStr = new Date().toISOString().slice(0, 10);
    setVocabulary((prev) =>
      prev.map((v) =>
        v.id === current.id
          ? {
              ...v,
              quizCount: (v.quizCount || 0) + 1,
              correctCount: (v.correctCount || 0) + (isCorrect ? 1 : 0),
              wrongCount: (v.wrongCount || 0) + (isCorrect ? 0 : 1),
              consecutiveCorrect: isCorrect ? (v.consecutiveCorrect || 0) + 1 : 0,
              lastQuizDate: todayStr,
            }
          : v
      )
    );

    // 4. Supabase DB 저장은 백그라운드에서 비동기로 실행 (UI를 차단하지 않음)
    updateQuizStat(current.id, isCorrect, currentUser?.id).catch((e) => {
      console.warn('Background updateQuizStat exception:', e);
    });
  }

  function handleNextQuestion() {
    const nextIdx = currentQuizIndex + 1;
    setCurrentQuizIndex(nextIdx);
    setupQuestion(nextIdx, quizList);
  }

  // Highlight word helper (불규칙 변화형, 복수형(-ies, -es, -s), 시제 변화, 대소문자 완벽 대응 + 정규식 캐싱)
  const highlightRegexCacheRef = useRef<Map<string, { splitRegex: RegExp; matchRegex: RegExp } | null>>(new Map());

  function renderHighlightedContext(text: string, word: string) {
    if (!text || !word) return text;
    const base = word.trim().toLowerCase();
    if (!base) return text;

    let cachedRegex = highlightRegexCacheRef.current.get(base);
    if (cachedRegex === undefined) {
      const lemma = extractLemmaCandidate(base);
      const allVariantsSet = new Set<string>([
        base,
        lemma,
        ...generateWordVariants(base),
        ...(lemma ? generateWordVariants(lemma) : []),
      ]);

      const escapedVariants = Array.from(allVariantsSet)
        .filter((v) => v && v.length > 0)
        .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .sort((a, b) => b.length - a.length);

      if (escapedVariants.length === 0) {
        highlightRegexCacheRef.current.set(base, null);
        return text;
      }

      const pattern = `\\b(?:${escapedVariants.join('|')})[a-zA-Z]*\\b`;
      cachedRegex = {
        splitRegex: new RegExp(`(${pattern})`, 'gi'),
        matchRegex: new RegExp(`^${pattern}$`, 'i'),
      };
      highlightRegexCacheRef.current.set(base, cachedRegex);
    }

    if (!cachedRegex) return text;

    const parts = text.split(cachedRegex.splitRegex);
    return parts.map((part, i) =>
      cachedRegex!.matchRegex.test(part) ? (
        <span key={i} className="highlight-word">
          {part}
        </span>
      ) : (
        part
      )
    );
  }

  // Fill sample inputs
  function fillSample(w: string, c: string, s: string, b: string = '샘플 단어장') {
    setInputBookTitle(b);
    const targetId = wordEntries[0]?.id || 'first';
    setWordEntries((prev) => {
      const first = prev[0] || createWordEntryItem({ id: targetId });
      return [
        {
          ...first,
          word: w,
          context: c,
          sourceMemo: s,
        },
        ...prev.slice(1),
      ];
    });
    executeSearchForEntry(targetId, w);
  }

  // Available unique book titles sorted by recency (가장 최근에 사용/등록된 단어장이 맨 위에 가깝게)
  const availableBookTitles = useMemo(() => {
    const vocabTitles = Array.from(
      new Set(vocabulary.map((v) => v.bookTitle || '기본 단어장').filter(Boolean))
    );
    const rawTitles = Array.from(
      new Set(
        vocabTitles.length > 0
          ? [inputBookTitle, ...vocabTitles].filter((t) => t && !t.includes('햄릿'))
          : [inputBookTitle || '원서 첫걸음: 어린 왕자']
      )
    );

    const getScore = (title: string): number => {
      // 1) 명시적으로 최근에 사용(선택/저장)된 기록
      if (bookUsageMap[title]) return bookUsageMap[title];

      // 2) 현재 폼에 선택된 단어장
      if (title === inputBookTitle) return Date.now();

      // 3) 해당 단어장의 단어들 중 가장 최근 등록일자
      const items = vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === title);
      let maxTime = 0;
      for (const item of items) {
        const t = item.created_at
          ? new Date(item.created_at).getTime()
          : item.date
          ? new Date(item.date).getTime()
          : 0;
        if (t > maxTime) maxTime = t;
      }
      return maxTime;
    };

    return [...rawTitles].sort((a, b) => getScore(b) - getScore(a));
  }, [vocabulary, inputBookTitle, bookUsageMap]);

  // Helper for multi-book selection
  const isAllBooksSelected = useMemo(() => {
    return (
      selectedBookFilters.includes('all') ||
      selectedBookFilters.length === 0 ||
      (availableBookTitles.length > 0 && selectedBookFilters.length === availableBookTitles.length)
    );
  }, [selectedBookFilters, availableBookTitles]);

  const isBookSelected = useCallback((title: string) => {
    if (isAllBooksSelected) return true;
    return selectedBookFilters.includes(title);
  }, [isAllBooksSelected, selectedBookFilters]);

  // Backward compatibility string
  const selectedBookFilter = useMemo(() => {
    if (isAllBooksSelected) return 'all';
    return selectedBookFilters.length === 1 ? selectedBookFilters[0] : selectedBookFilters[0];
  }, [isAllBooksSelected, selectedBookFilters]);

  const setSelectedBookFilter = useCallback((val: string) => {
    if (val === 'all') {
      setSelectedBookFilters(['all']);
    } else {
      setSelectedBookFilters([val]);
    }
  }, []);

  const toggleBookCheckbox = useCallback((book: string) => {
    if (isListeningSentences) {
      cancelSentencePlayRef.current = true;
      stopTTS();
      setIsListeningSentences(false);
      setCurrentSentencePlayIdx(-1);
    }

    if (isAllBooksSelected) {
      const remaining = availableBookTitles.filter((t) => t !== book);
      if (remaining.length === 0) {
        setSelectedBookFilters(['all']);
      } else {
        setSelectedBookFilters(remaining);
      }
      return;
    }

    if (selectedBookFilters.includes(book)) {
      const next = selectedBookFilters.filter((b) => b !== book);
      if (next.length === 0) {
        setSelectedBookFilters(['all']);
      } else {
        setSelectedBookFilters(next);
      }
    } else {
      const next = [...selectedBookFilters, book];
      if (next.length >= availableBookTitles.length) {
        setSelectedBookFilters(['all']);
      } else {
        setSelectedBookFilters(next);
        touchBookUsage(book);
      }
    }
  }, [isListeningSentences, isAllBooksSelected, availableBookTitles, selectedBookFilters, touchBookUsage]);

  const selectOnlyBook = useCallback((book: string) => {
    if (isListeningSentences) {
      cancelSentencePlayRef.current = true;
      stopTTS();
      setIsListeningSentences(false);
      setCurrentSentencePlayIdx(-1);
    }
    setSelectedBookFilters([book]);
    touchBookUsage(book);
  }, [isListeningSentences, touchBookUsage]);

  // Filtered vocabulary list in random order
  const filteredVocabulary = useMemo(() => {
    const list = isAllBooksSelected
      ? [...vocabulary]
      : vocabulary.filter((v) => selectedBookFilters.includes(v.bookTitle || '기본 단어장'));

    // Fisher-Yates random shuffle
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [vocabulary, isAllBooksSelected, selectedBookFilters, shuffleKey]);

  // Selected book summary stats for the info display
  const selectedBookStats = useMemo(() => {
    const isAll = isAllBooksSelected;
    const items = isAll
      ? vocabulary
      : vocabulary.filter((v) => selectedBookFilters.includes(v.bookTitle || '기본 단어장'));

    const totalWords = items.length;
    const totalQuiz = items.reduce((acc, v) => acc + (v.quizCount || 0), 0);
    const totalCorrect = items.reduce((acc, v) => acc + (v.correctCount || 0), 0);
    const accuracy = totalQuiz > 0 ? Math.round((totalCorrect / totalQuiz) * 100) : 0;
    const masteredCount = items.filter(
      (v) => (v.quizCount || 0) >= 2 && Math.round(((v.correctCount || 0) / (v.quizCount || 1)) * 100) >= 80
    ).length;

    let title = '전체 단어장 보기';
    if (!isAll) {
      if (selectedBookFilters.length === 1) {
        title = selectedBookFilters[0];
      } else {
        title = `${selectedBookFilters[0]} 외 ${selectedBookFilters.length - 1}개`;
      }
    }

    return {
      title,
      isAll,
      totalWords,
      totalQuiz,
      totalCorrect,
      accuracy,
      masteredCount,
    };
  }, [vocabulary, isAllBooksSelected, selectedBookFilters]);

  // 문장 듣기 (연속 낭독) 대상 목록 (문맥 예문이 있는 단어 우선)
  const sentencePlayList = useMemo(() => {
    const withSentence = filteredVocabulary.filter((v) => {
      const s = v.contextSentence;
      return s && s.trim().length > 0;
    });
    return withSentence.length > 0 ? withSentence : filteredVocabulary;
  }, [filteredVocabulary]);

  // 문장 연속 듣기 토글 핸들러 (현재 선택된 단어장의 모든 문장을 무한 반복 연속 낭독)
  const handleToggleListenSentences = useCallback(async () => {
    if (isListeningSentences) {
      cancelSentencePlayRef.current = true;
      stopTTS();
      setIsListeningSentences(false);
      setCurrentSentencePlayIdx(-1);
      return;
    }

    if (sentencePlayList.length === 0) {
      alert('들려줄 단어 또는 문맥 예문이 없습니다.');
      return;
    }

    cancelSentencePlayRef.current = false;
    setIsListeningSentences(true);

    // 사용자가 중지할 때까지 현재 선택된 단어장의 문장들을 계속 반복 낭독
    while (!cancelSentencePlayRef.current) {
      for (let i = 0; i < sentencePlayList.length; i++) {
        if (cancelSentencePlayRef.current) break;
        setCurrentSentencePlayIdx(i);

        const item = sentencePlayList[i];
        const cardSentenceIdx = listCardSentenceIdx[item.id] || 0;
        const textToRead = (
          (item.candidateSentences && item.candidateSentences.length > 0
            ? item.candidateSentences[cardSentenceIdx % item.candidateSentences.length]
            : item.contextSentence) || item.word
        ).trim();

        // 다음 재생할 문장 백그라운드 사전 캐싱 (0ms 지연 재생 보장)
        const nextIdx = (i + 1) % sentencePlayList.length;
        const nextItem = sentencePlayList[nextIdx];
        if (nextItem) {
          const nextCardIdx = listCardSentenceIdx[nextItem.id] || 0;
          const nextText = (
            (nextItem.candidateSentences && nextItem.candidateSentences.length > 0
              ? nextItem.candidateSentences[nextCardIdx % nextItem.candidateSentences.length]
              : nextItem.contextSentence) || nextItem.word
          ).trim();
          preloadSentenceTTS(nextText, ttsVoice);
        }

        // 현재 낭독 중인 단어 카드로 부드럽게 스크롤
        if (typeof document !== 'undefined') {
          const el = document.getElementById(`vocab-card-${item.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }

        // 원어민 음성으로 읽기
        await speakSentenceTTS(textToRead, ttsVoice, ttsRate);

        if (cancelSentencePlayRef.current) break;

        // 다음 문장 넘어가기 전 0.8초의 편안한 쉼
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsListeningSentences(false);
    setCurrentSentencePlayIdx(-1);
  }, [isListeningSentences, sentencePlayList, listCardSentenceIdx, ttsVoice, ttsRate]);

  // 탭 변경 시 문장 연속 낭독 즉시 중지
  useEffect(() => {
    if (activeTab !== 'list' && isListeningSentences) {
      cancelSentencePlayRef.current = true;
      stopTTS();
      setIsListeningSentences(false);
      setCurrentSentencePlayIdx(-1);
    }
  }, [activeTab, isListeningSentences]);

  // 바깥 클릭 시 단어장 다중 선택 팝오버 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bookSelectorRef.current && !bookSelectorRef.current.contains(e.target as Node)) {
        setIsBookSelectorOpen(false);
      }
    };
    if (isBookSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBookSelectorOpen]);

  // 바깥 클릭 시 단어 등록 탭 단어장 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addBookDropdownRef.current && !addBookDropdownRef.current.contains(e.target as Node)) {
        setIsAddBookDropdownOpen(false);
      }
    };
    if (isAddBookDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddBookDropdownOpen]);


  const currentQuizItem = quizList[currentQuizIndex];

  return (
    <>
      {/* Header (Mobile First Clean 2-Tier Structure) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white shadow-xs ring-1 ring-slate-200/80 overflow-hidden flex items-center justify-center p-0.5 select-none shrink-0">
              <img src="/icon.png" alt="divivid logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base text-slate-900 tracking-tight leading-none">
                  원서. 문장. 단어
                </h1>
                <span className="hidden sm:inline-block text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-bold">
                  divivid
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block mt-0.5">
                원서·기사 문맥 영한 단어장 & 5지선다 퀴즈
              </p>
            </div>
          </div>

          {/* Right Utility Controls (Account & Settings Unified) */}
          <div className="flex items-center shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthSuccessMsg(null);
                  if (!currentUser && (authMode === 'forgot' || authMode === 'reset')) {
                    setAuthMode('login');
                  }
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className="flex items-center gap-1.5 p-1 text-slate-700 hover:text-slate-950 transition cursor-pointer"
                title={currentUser ? '계정 및 설정' : '로그인 및 설정'}
              >
                {currentUser ? (
                  <>
                    {effectiveAvatar ? (
                      <img
                        src={effectiveAvatar}
                        alt="Profile"
                        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {(effectiveDisplayName || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline text-xs font-bold max-w-[85px] truncate">
                      {effectiveDisplayName}
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black px-1.5 py-0.5 rounded-full shadow-2xs">
                        👑 관리자
                      </span>
                    )}
                  </>
                ) : (
                  <UserIcon className="w-5 h-5 text-slate-700 shrink-0" />
                )}
              </button>

              {/* Unified Account & Settings Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 space-y-2.5 animate-fade-in text-xs">
                    {/* TOP SECTION: Immediate Login Form (if guest) OR Account Info (if logged in) */}
                    {currentUser ? (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {effectiveAvatar ? (
                            <img
                              src={effectiveAvatar}
                              alt="Profile"
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {(effectiveDisplayName || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 truncate">
                                {effectiveDisplayName}
                              </p>
                              {isAdmin && (
                                <span className="text-[9px] bg-purple-100 text-purple-800 font-extrabold px-1.5 py-0.5 rounded-md border border-purple-200">
                                  👑 관리자
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-[11px] rounded-lg transition cursor-pointer shrink-0"
                        >
                          로그아웃
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 pb-1">
                        {/* Mode Switch (Login / Signup) */}
                        {authMode === 'forgot' ? (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">비밀번호 재설정</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode('login');
                                setAuthError(null);
                                setAuthSuccessMsg(null);
                              }}
                              className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
                            >
                              ← 로그인으로
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 p-0.5 bg-slate-100 rounded-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode('login');
                                setAuthError(null);
                                setAuthSuccessMsg(null);
                              }}
                              className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                authMode === 'login'
                                  ? 'bg-white text-indigo-600 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              로그인
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode('signup');
                                setAuthError(null);
                                setAuthSuccessMsg(null);
                              }}
                              className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                authMode === 'signup'
                                  ? 'bg-white text-indigo-600 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              회원가입
                            </button>
                          </div>
                        )}

                        {authError && (
                          <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                            <span>{authError}</span>
                          </div>
                        )}
                        {authSuccessMsg && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[11px] flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                            <span>{authSuccessMsg}</span>
                          </div>
                        )}

                        {/* Direct Email / Password Inputs */}
                        <form onSubmit={handleEmailAuthSubmit} className="space-y-2">
                          <input
                            type="email"
                            required
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            placeholder="이메일 (아이디)"
                            className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 transition"
                          />

                          {authMode !== 'forgot' && (
                            <input
                              type="password"
                              required
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              placeholder={authMode === 'signup' ? '비밀번호 (6자 이상)' : '비밀번호'}
                              className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 transition"
                            />
                          )}

                          {authMode === 'signup' && (
                            <input
                              type="password"
                              required
                              value={authPasswordConfirm}
                              onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                              placeholder="비밀번호 확인"
                              className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 transition"
                            />
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="submit"
                              disabled={isAuthSubmitting}
                              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {isAuthSubmitting ? (
                                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <span>
                                  {authMode === 'login'
                                    ? '로그인'
                                    : authMode === 'signup'
                                    ? '회원가입'
                                    : '재설정 메일 발송'}
                                </span>
                              )}
                            </button>
                            {authMode === 'login' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAuthMode('forgot');
                                  setAuthError(null);
                                  setAuthSuccessMsg(null);
                                }}
                                className="text-[11px] text-slate-400 hover:text-indigo-600 font-medium shrink-0 cursor-pointer"
                              >
                                비번 찾기
                              </button>
                            )}
                          </div>
                        </form>

                        {/* Direct Google Login Button */}
                        {authMode !== 'forgot' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              handleGoogleLoginClick();
                            }}
                            disabled={isLoggingIn}
                            className="w-full py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                          >
                            <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>Google로 로그인</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reorganized Clean Menu Items */}
                    <button
                      type="button"
                      onClick={() => {
                        openSettingsWithTab('preferences');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5 text-slate-600" />
                        <span>앱 & 퀴즈 설정</span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold">
                        {quizQuestionCount === 0 ? '전체' : `${quizQuestionCount}문제`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        openSettingsWithTab('profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{currentUser ? '프로필 & 사진 변경' : '프로필 설정'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        openSettingsWithTab('ai');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-brand-600" />
                        <span>Gemini AI 연동</span>
                      </div>
                      {geminiApiKey && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                          연동됨
                        </span>
                      )}
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          openSettingsWithTab('admin');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-950 font-bold rounded-xl flex items-center justify-between transition cursor-pointer border border-purple-200/80 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">👑</span>
                          <span>Vercel 서버 API 모니터링</span>
                        </div>
                        <span className="text-[9px] bg-purple-600 text-white font-black px-1.5 py-0.5 rounded-full">
                          관리자
                        </span>
                      </button>
                    )}

                    {currentUser && (
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 font-bold rounded-xl flex items-center gap-2 transition cursor-pointer border-t border-slate-100"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>로그아웃</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Global Announcement Banner (Broadcast by Administrator) */}
      {announcement?.active && announcement?.message && dismissedAnnouncementId !== announcement.id && (
        <div
          className={`border-b px-4 py-2 text-xs font-semibold shadow-2xs animate-fade-in ${
            announcement.type === 'warning'
              ? 'bg-amber-500/10 text-amber-900 border-amber-200'
              : announcement.type === 'update'
              ? 'bg-indigo-500/10 text-indigo-900 border-indigo-200'
              : 'bg-blue-500/10 text-blue-900 border-blue-200'
          }`}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">
                {announcement.type === 'warning' ? '⚠️' : announcement.type === 'update' ? '🚀' : '💡'}
              </span>
              <span className="truncate">{announcement.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setDismissedAnnouncementId(announcement.id)}
              className="p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0 rounded-lg hover:bg-black/5"
              title="공지 닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container (Scroll Area with Touch Swipe between 3 Tabs) */}
      <main
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="max-w-5xl mx-auto w-full px-3.5 sm:px-4 py-3 sm:py-4 flex-1 overflow-x-hidden touch-pan-y"
      >
        {/* 3-Tab Bar (Now in Scroll Area - Scrolls naturally with content & Swipeable) */}
        <div className="mb-3">
          <nav className="grid grid-cols-3 gap-1 bg-slate-100/90 border border-slate-200/90 p-1 rounded-2xl text-center shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`py-2 px-1 text-xs rounded-xl transition font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>단어 등록</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`py-2 px-1 text-xs rounded-xl transition font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>단어장</span>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {vocabulary.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'quiz') return;
                if (quizList.length > 0 && !isQuizFinished) {
                  setActiveTab('quiz');
                } else {
                  startQuiz();
                }
              }}
              className={`py-2 px-1 text-xs rounded-xl transition font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>5지선다 🎯</span>
            </button>
          </nav>

          {/* Swipe Guide Dots (Mobile Only) */}
          <div className="flex justify-center items-center gap-1.5 mt-1.5 select-none sm:hidden">
            <span
              className={`h-1 rounded-full transition-all duration-200 ${
                activeTab === 'add' ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300'
              }`}
            />
            <span
              className={`h-1 rounded-full transition-all duration-200 ${
                activeTab === 'list' ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300'
              }`}
            />
            <span
              className={`h-1 rounded-full transition-all duration-200 ${
                activeTab === 'quiz' ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300'
              }`}
            />
          </div>
        </div>

        {/* Interactive Swipe Carousel Container */}
        <div className="w-full overflow-hidden">
          <div
            ref={carouselTrackRef}
            className="flex w-full items-start will-change-transform"
            style={{
              transform: `translateX(-${TAB_ORDER.indexOf(activeTab) * 100}%)`,
              transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            }}
          >
            {/* ========================================= */}
            {/* TAB 1: ADD WORD & CONTEXT */}
            {/* ========================================= */}
            <div
              className={`w-full min-w-full shrink-0 transition-opacity duration-200 ${
                activeTab === 'add' || isSwiping || isTransitioning
                  ? 'opacity-100'
                  : 'h-0 max-h-0 overflow-hidden opacity-0 pointer-events-none'
              }`}
            >
              <section className="max-w-2xl mx-auto w-full min-w-0 space-y-3 sm:space-y-4">
                {/* Book Title Selection / Input (단어장 드롭다운 단일 선택 - 화면 공간 최소화) */}
                <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative" ref={addBookDropdownRef}>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                      <BookMarked className="w-3.5 h-3.5 text-indigo-600" />
                      <span>저장할 단어장 <span className="text-rose-500">*</span></span>
                    </label>
                    <span className="text-[10.5px] text-slate-400 font-medium">
                      총 {availableBookTitles.length}개 단어장
                    </span>
                  </div>

                  {isCustomBook ? (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <input
                        type="text"
                        value={customBookInput}
                        onChange={(e) => setCustomBookInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = customBookInput.trim();
                            if (trimmed) {
                              handleSwitchBook(trimmed);
                              setIsCustomBook(false);
                              setCustomBookInput('');
                            }
                          }
                        }}
                        placeholder="새 단어장 이름 입력 (예: 코스모스, 토익 필수)"
                        className="flex-1 px-3 py-2 text-xs bg-white text-slate-900 border-2 border-indigo-500 rounded-xl focus:outline-none font-bold"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = customBookInput.trim();
                          if (trimmed) {
                            handleSwitchBook(trimmed);
                            setIsCustomBook(false);
                            setCustomBookInput('');
                          }
                        }}
                        disabled={!customBookInput.trim()}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shrink-0 cursor-pointer shadow-xs"
                      >
                        추가
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomBook(false);
                          setCustomBookInput('');
                        }}
                        className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* 닫힘 상태: 선택된 단어장 1개만 표시하는 컴팩트 드롭다운 트리거 */}
                      {(() => {
                        const activeTitle = selectedTargetBooks[0] || inputBookTitle || '기본 단어장';
                        const activeCount = vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === activeTitle).length;
                        return (
                          <button
                            type="button"
                            onClick={() => setIsAddBookDropdownOpen((prev) => !prev)}
                            className="w-full px-3 py-2.5 bg-slate-50 hover:bg-indigo-50/60 text-slate-900 border border-slate-200 hover:border-indigo-300 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer text-left shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span className="text-xs font-extrabold text-slate-900 truncate">
                                {activeTitle}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {activeCount}단어
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                                  isAddBookDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                                }`}
                              />
                            </div>
                          </button>
                        );
                      })()}

                      {/* 열림 상태: 클릭 시 펼쳐지는 단일 선택 드롭다운 목록 */}
                      {isAddBookDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 animate-fade-in">
                          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                            {availableBookTitles.map((title) => {
                              const isSelected = (selectedTargetBooks[0] || inputBookTitle) === title;
                              const count = vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === title).length;
                              return (
                                <button
                                  key={title}
                                  type="button"
                                  onClick={() => {
                                    handleToggleTargetBook(title);
                                    setIsAddBookDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer text-left ${
                                    isSelected
                                      ? 'bg-indigo-50 text-indigo-950'
                                      : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border-2 transition ${
                                        isSelected
                                          ? 'border-indigo-600 bg-indigo-600'
                                          : 'border-slate-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="truncate">{title}</span>
                                  </div>
                                  <span
                                    className={`text-[11px] shrink-0 font-medium ${
                                      isSelected ? 'text-indigo-600 font-bold' : 'text-slate-400'
                                    }`}
                                  >
                                    {count}단어
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* 드롭다운 하단: 새 단어장 추가 버튼 */}
                          <div className="p-1.5 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddBookDropdownOpen(false);
                                setIsCustomBook(true);
                              }}
                              className="w-full py-2 px-3 bg-white hover:bg-indigo-50 border border-dashed border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-indigo-600" />
                              <span>새 단어장 추가하기</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Hidden Camera Input (카메라 직접 촬영: capture="environment") */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handlePagePhotoUpload}
                  className="hidden"
                />

                {/* Hidden Gallery Input (사진첩/앨범 선택 전용: capture 속성 없이 갤러리 열기) */}
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/*"
                  onChange={handlePagePhotoUpload}
                  className="hidden"
                />

                {/* Legacy fileInputRef fallback */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePagePhotoUpload}
                  className="hidden"
                />

                {/* Page Photo Capture / Direct Source Sentence & Paste Card */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
                      <BookOpen className="w-4 h-4 text-brand-600" />
                      <span>원문 문장</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {pageOcrText ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>
                            {loadedSourceType === 'web'
                              ? (loadedWebTitle ? (loadedWebTitle.length > 15 ? loadedWebTitle.slice(0, 15) + '...' : loadedWebTitle) : '웹/본문 로드됨')
                              : (sourceImages.length > 1 ? '연속 2장 연결됨 📄' : '사진 인식됨 📸')}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          사진 촬영 or 원문/URL 붙여넣기
                        </span>
                      )}
                    </div>
                  </div>

                  {isSourceProcessing ? (
                    <div className="py-2.5 px-3 bg-white/95 rounded-xl border border-indigo-200 shadow-xs space-y-1 animate-pulse">
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-800 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                          <span className="truncate">백그라운드에서 {sourceProcessTaskName || '원문'} 분석 중...</span>
                        </div>
                        {isOcrProcessing && (
                          <span className="font-mono text-indigo-600 font-black text-xs shrink-0">
                            ⏱️ {(ocrElapsedMs / 1000).toFixed(1)}초
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        기다리지 말고 아래 단어를 바로 입력하세요! 분석 완료 시 문장이 자동 연결됩니다.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* OCR 엔진 표시 뱃지 (AI Vision vs Tesseract 명확화) */}
                      {lastOcrEngineInfo && (
                        <div
                          className={`p-2 sm:p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition ${
                            lastOcrEngineInfo.method === 'gemini_vision'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                              : lastOcrEngineInfo.method === 'gemini_repair'
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                              : lastOcrEngineInfo.method === 'web'
                              ? 'bg-slate-100 border-slate-300 text-slate-800'
                              : 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {lastOcrEngineInfo.method === 'gemini_vision' ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            ) : lastOcrEngineInfo.method === 'gemini_repair' ? (
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            ) : lastOcrEngineInfo.method === 'web' ? (
                              <Globe className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            <div className="truncate">
                              <span className="font-bold text-[11px] sm:text-xs">
                                {lastOcrEngineInfo.method === 'gemini_vision' && '🤖 Google Gemini Vision AI (고정밀)'}
                                {lastOcrEngineInfo.method === 'gemini_repair' && '✨ Gemini AI 문맥 복원 (오타 교정됨)'}
                                {lastOcrEngineInfo.method === 'tesseract' && '⚠️ Tesseract.js (무료 로컬 기본 엔진)'}
                                {lastOcrEngineInfo.method === 'web' && '🌐 웹 기사 스크래퍼'}
                              </span>
                              {lastOcrEngineInfo.method === 'tesseract' && lastOcrEngineInfo.failureReason && (
                                <span className="block sm:inline sm:ml-1 text-[10px] text-amber-800 font-semibold">
                                  (AI 실패 사유: {lastOcrEngineInfo.failureReason})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {lastOcrEngineInfo.method === 'tesseract' && (
                              <button
                                type="button"
                                onClick={() => handleAiCleanPageText()}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-[10px] sm:text-[11px] shrink-0 shadow-xs cursor-pointer flex items-center gap-1"
                                title="Tesseract가 잘못 읽은 글자를 Gemini AI로 깔끔하게 교정합니다"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>AI 오타 교정 🪄</span>
                              </button>
                            )}
                            {ocrTimingStats && (
                              <button
                                type="button"
                                onClick={() => setIsOcrTimingExpanded((prev) => !prev)}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white/80 hover:bg-white border border-slate-300/80 text-slate-600 flex items-center gap-1 shrink-0 cursor-pointer transition"
                                title="단계별 상세 처리 시간 보기/접기"
                              >
                                <span>상세</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${isOcrTimingExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ⏱️ 단계별 처리 시간 진단 카드 (기본 접힘 - 상세 버튼 클릭 시에만 펼침, 각 항목 합계 === 총 소요 시간) */}
                      {ocrTimingStats && isOcrTimingExpanded && (() => {
                        const totalSec = Number((ocrTimingStats.totalMs / 1000).toFixed(2));
                        const compressSec = Number((ocrTimingStats.compressionMs / 1000).toFixed(2));
                        const geminiServerSec = Number(((ocrTimingStats.serverDurationMs || 0) / 1000).toFixed(2));
                        const tesseractSec = Number(((ocrTimingStats.tesseractMs || 0) / 1000).toFixed(2));
                        const repairSec = Number(((ocrTimingStats.repairMs || 0) / 1000).toFixed(2));
                        const transferSec = Number(
                          Math.max(0, totalSec - compressSec - geminiServerSec - tesseractSec - repairSec).toFixed(2)
                        );
                        const sumParts = [
                          compressSec.toFixed(2),
                          transferSec.toFixed(2),
                          ...(geminiServerSec > 0 ? [geminiServerSec.toFixed(2)] : []),
                          ...(tesseractSec > 0 ? [tesseractSec.toFixed(2)] : []),
                          ...(repairSec > 0 ? [repairSec.toFixed(2)] : []),
                        ];

                        return (
                          <div className="bg-slate-900 text-slate-100 rounded-xl p-3 text-xs font-mono shadow-sm border border-slate-800 space-y-2 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
                              <div className="flex items-center gap-1.5 font-bold text-slate-200 min-w-0">
                                <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="truncate">⏱️ 단계별 소요 시간 ({APP_BUILD_VERSION.split(' ')[0]})</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                총 {totalSec.toFixed(2)}초
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-slate-800/70 p-2 rounded-lg border border-slate-700/50 space-y-0.5">
                                <div className="text-slate-400 font-bold flex items-center justify-between">
                                  <span>1. 🖼️ 이미지 압축</span>
                                  <span className="text-amber-300 font-black">{compressSec.toFixed(2)}초</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  용량: {ocrTimingStats.originalFileSizeKb}KB ➔ {ocrTimingStats.compressedSizeKb}KB
                                </div>
                                {ocrTimingStats.originalDimensions && (
                                  <div className="text-[10px] text-slate-400">
                                    해상도: {ocrTimingStats.originalDimensions} ➔ {ocrTimingStats.compressedDimensions}
                                  </div>
                                )}
                              </div>

                              <div className="bg-slate-800/70 p-2 rounded-lg border border-slate-700/50 space-y-0.5">
                                <div className="text-slate-400 font-bold flex items-center justify-between">
                                  <span>2. 📡 데이터 송/수신 + 서버 대기</span>
                                  <span className="text-sky-300 font-black">{transferSec.toFixed(2)}초</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  네트워크 업/다운로드 및 Vercel 서버 응답 대기 (서울 icn1)
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-800/70 p-2 rounded-lg border border-slate-700/50 text-[11px] space-y-0.5">
                              <div className="text-slate-400 font-bold flex items-center justify-between">
                                <span>3. 🤖 AI Vision 서버 처리</span>
                                <span className="text-cyan-300 font-black">{geminiServerSec.toFixed(2)}초</span>
                              </div>
                              <div className="text-[10px] text-slate-400 break-all">
                                모델: {ocrTimingStats.modelUsed || 'default'}
                              </div>
                              {ocrTimingStats.attemptLogs && ocrTimingStats.attemptLogs.length > 0 && (
                                <div className="text-[9.5px] text-cyan-200/90 pt-0.5 break-all">
                                  시도: {ocrTimingStats.attemptLogs.join(' ➔ ')}
                                </div>
                              )}
                              {ocrTimingStats.visionError && (
                                <div className="text-[9.5px] text-rose-300 pt-0.5 break-all">
                                  오류: {ocrTimingStats.visionError}
                                </div>
                              )}
                            </div>

                            {tesseractSec > 0 ? (
                              <div className="bg-rose-950/50 p-2 rounded-lg border border-rose-800/60 text-[11px] text-rose-300 space-y-0.5">
                                <div className="font-bold flex items-center justify-between text-rose-200">
                                  <span>4. ⚠️ 로컬 Tesseract 폴백</span>
                                  <span className="font-black">{tesseractSec.toFixed(2)}초</span>
                                </div>
                                <div className="text-[10px] text-rose-300/80">
                                  사유: {ocrTimingStats.visionError || 'Vision API 실패/타임아웃'}
                                </div>
                              </div>
                            ) : null}

                            {repairSec > 0 ? (
                              <div className="bg-indigo-950/50 p-2 rounded-lg border border-indigo-800/60 text-[11px] text-indigo-300 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span>5. ✨ Gemini 텍스트 문맥 복원 ({ocrTimingStats.repairModelUsed || 'gemini'})</span>
                                  <span className="font-black text-indigo-200">{repairSec.toFixed(2)}초</span>
                                </div>
                                {ocrTimingStats.repairAttemptLogs && ocrTimingStats.repairAttemptLogs.length > 0 && (
                                  <div className="text-[9.5px] text-indigo-200/80 break-all">
                                    시도: {ocrTimingStats.repairAttemptLogs.join(' ➔ ')}
                                  </div>
                                )}
                              </div>
                            ) : null}

                            <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                              <span>검산 합계</span>
                              <span className="text-emerald-300 font-bold">
                                {sumParts.join(' + ')} = {totalSec.toFixed(2)}초
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 원문 문장 칸 (직접 붙여넣기 및 편집 가능) */}
                      <div className="relative">
                        <textarea
                          rows={pageOcrText ? 3 : 2}
                          value={pageOcrText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPageOcrText(val);
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('context_vocab_cached_page_ocr', val);
                            }
                            // 단어장 내 단어와 실시간 매칭
                            if (val.trim().length >= 10) {
                              wordEntries.forEach((entry) => {
                                const w = entry.word.trim();
                                if (w.length >= 2 && !entry.context) {
                                  const matches = findAllSentencesWithWordSmart(val, w);
                                  if (matches.length > 0) {
                                    const sentences = matches.map((m) => m.sentence);
                                    updateWordEntry(entry.id, {
                                      candidateSentences: sentences,
                                      context: matches[0].sentence,
                                      ocrDetectedNotice:
                                        sentences.length > 1
                                          ? `✨ 본문 내에서 이 단어가 ${sentences.length}번 쓰였습니다!`
                                          : '✨ 본문에서 원문 문장을 자동으로 찾았습니다!',
                                    });
                                    handleTranslateContextSentence(entry.id, matches[0].sentence, true);
                                  }
                                }
                              });
                            }
                          }}
                          onPaste={async (e) => {
                            const pasteText = e.clipboardData?.getData('text') || '';
                            const detected = detectContentType(pasteText);
                            if (detected.type === 'url' && detected.cleanUrl) {
                              e.preventDefault();
                              triggerToast('🌐 웹 URL 감지됨!', '기사 본문을 자동으로 불러옵니다.');
                              await handleScrapeUrl(detected.cleanUrl);
                            } else if (pasteText.trim() && pasteText.trim().length > 150) {
                              // 긴 본문 텍스트 붙여넣기 시 광고/배너 자동 정제 지원
                              e.preventDefault();
                              await handleApplyPastedText(pasteText);
                            }
                          }}
                          placeholder="원문 문장, 기사 글, 또는 웹페이지 URL을 바로 여기에 붙여넣으세요..."
                          className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-brand-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-serif leading-relaxed placeholder:text-slate-400 shadow-2xs resize-y"
                        />
                      </div>

                      {/* URL이 직접 입력된 경우 즉시 본문 불러오기 안내 버튼 */}
                      {detectContentType(pageOcrText).type === 'url' && (
                        <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs animate-fade-in">
                          <div className="flex items-center gap-1.5 text-indigo-900 font-bold truncate">
                            <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">웹 URL이 입력되었습니다!</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleScrapeUrl(detectContentType(pageOcrText).cleanUrl)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shrink-0 text-[11px] shadow-xs cursor-pointer active:scale-95"
                          >
                            본문 불러오기 ➔
                          </button>
                        </div>
                      )}

                      {/* 핵심 액션 버튼군 (URL 버튼 제거됨) */}
                      {pageOcrText ? (
                        <div className="grid grid-cols-4 gap-1.5 pt-0.5 w-full">
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="w-full h-9 text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 whitespace-nowrap px-1"
                            title="카메라 촬영 또는 사진첩 선택"
                          >
                            <Camera className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            <span>카메라</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleClipboardPasteSmart}
                            className="w-full h-9 text-xs font-bold bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 whitespace-nowrap px-1"
                            title="클립보드 내용 새로 붙여넣기 (URL 또는 글 자동 판별)"
                          >
                            <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>붙여넣기</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWordsFromText([]);
                              setIsWordSelectModalOpen(true);
                            }}
                            className="w-full h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap px-1"
                            title="원문 본문 속 모르는 단어 직접 선택"
                          >
                            <ScanLine className="w-3.5 h-3.5 text-white shrink-0" />
                            <span>단어 선택</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPageOcrText('');
                              setLoadedSourceType(null);
                              setLoadedWebTitle('');
                              setCurrentSourceImage(null);
                              currentSourceImageRef.current = null;
                              setSourceImages([]);
                              sourceImagesRef.current = [];
                              if (typeof window !== 'undefined') {
                                localStorage.removeItem('context_vocab_cached_page_ocr');
                                sessionStorage.removeItem('context_vocab_source_image');
                                sessionStorage.removeItem('context_vocab_source_images');
                              }
                              deleteBookSourceData(inputBookTitle);
                            }}
                            className="w-full h-9 text-xs text-slate-500 hover:text-rose-600 font-bold bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 active:scale-95 px-1"
                            title="불러온 원문 지우기"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>지우기</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 pt-0.5 w-full">
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="w-full h-9 bg-white hover:bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold px-3.5 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
                            title="카메라 촬영 또는 사진첩 선택"
                          >
                            <Camera className="w-4 h-4 text-brand-600 shrink-0" />
                            <span>카메라</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleClipboardPasteSmart}
                            className="w-full h-9 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3.5 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
                            title="클립보드에서 바로 붙여넣기 (URL 또는 기사 글 자동 판별)"
                          >
                            <ClipboardPaste className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>클립보드 붙여넣기</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>


                {/* Multi-Word Form Cards List */}
                <div className="space-y-4">
                  {wordEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 overflow-hidden"
                    >
                      {/* Entry Card Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800 shrink-0">
                            단어 등록칸 #{index + 1}
                          </span>
                          {isValidMeaningDef(entry.selectedMeaning) && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full truncate max-w-[120px] sm:max-w-[180px]">
                              ✓ {entry.word} ({entry.selectedMeaning})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* 단어별 빠른 저장 버튼 */}
                          {(() => {
                            const isAnalyzing =
                              entry.isSearchingDict ||
                              entry.isAnalyzingContext ||
                              isSourceProcessing ||
                              translatingSentenceId === entry.id;

                            const canSave =
                              !isAnalyzing &&
                              Boolean(entry.dictResult?.word || entry.word.trim()) &&
                              isValidMeaningDef(entry.selectedMeaning);

                            return (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleWordEntry(entry.id)}
                                disabled={!canSave}
                                className={`text-xs font-bold px-2.5 sm:px-3 py-1 rounded-xl shadow-2xs transition flex items-center gap-1.5 ${
                                  canSave
                                    ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-95'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                                title={
                                  isAnalyzing
                                    ? 'AI가 원문 문맥 및 한글 해석을 분석 중입니다. 완료 후 저장할 수 있습니다.'
                                    : '이 단어를 단어장에 바로 저장합니다'
                                }
                              >
                                {isAnalyzing ? (
                                  <>
                                    <RotateCw className="w-3 h-3 animate-spin text-slate-500" />
                                    <span>AI 분석 중...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>저장</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                          {wordEntries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveWordEntry(entry.id)}
                              className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">삭제</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 1. Word Input */}
                      <div>
                        <div className="mb-1.5">
                          <label className="block text-xs font-bold text-slate-700">
                            영어 단어 <span className="text-rose-500">*</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
                          <input
                            type="text"
                            value={entry.word}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateWordEntry(entry.id, {
                                word: val,
                                dictResult: null,
                                selectedMeaning: '',
                                selectedPos: '',
                                ocrDetectedNotice: null,
                              });

                              // 실시간 자동완성 추천
                              const localMatches = getLiveDictCandidates(val);
                              updateWordEntry(entry.id, { liveCandidates: localMatches });
                              fetchLiveDictSuggestions(val).then((apiMatches) => {
                                if (apiMatches && apiMatches.length > 0) {
                                  updateWordEntry(entry.id, { liveCandidates: apiMatches });
                                }
                              });

                              // 타이핑 디바운스: 입력 멈추면 자동으로 사전 조회 & AI 문맥 뜻 선택 실행
                              if (wordDebounceTimersRef.current[entry.id]) {
                                clearTimeout(wordDebounceTimersRef.current[entry.id]);
                              }
                              const cleanWord = val.trim();
                              if (cleanWord.length >= 2) {
                                wordDebounceTimersRef.current[entry.id] = setTimeout(() => {
                                  executeSearchForEntry(entry.id, cleanWord);
                                }, 750);
                              }

                              // 사진 또는 URL 텍스트에서 단어 문장 자동 탐색
                              if (pageOcrText && val.trim().length >= 3) {
                                const matches = findAllSentencesWithWordSmart(pageOcrText, val.trim());
                                if (matches.length > 0) {
                                  const sentences = matches.map((m) => m.sentence);
                                  updateWordEntry(entry.id, {
                                    candidateSentences: sentences,
                                    context: matches[0].sentence,
                                    ocrDetectedNotice:
                                      sentences.length > 1
                                        ? `✨ 본문 내에서 이 단어가 ${sentences.length}번 쓰였습니다!`
                                        : '📸 본문에서 원문 문장을 자동으로 찾았습니다!',
                                  });
                                  handleTranslateContextSentence(entry.id, matches[0].sentence, true);
                                }
                              }
                            }}
                            onBlur={() => {
                              const cleanWord = entry.word.trim();
                              if (cleanWord.length >= 2 && !entry.dictResult && !entry.isSearchingDict) {
                                if (wordDebounceTimersRef.current[entry.id]) {
                                  clearTimeout(wordDebounceTimersRef.current[entry.id]);
                                }
                                executeSearchForEntry(entry.id, cleanWord);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (wordDebounceTimersRef.current[entry.id]) {
                                  clearTimeout(wordDebounceTimersRef.current[entry.id]);
                                }
                                executeSearchForEntry(entry.id);
                              }
                            }}
                            placeholder="단어를 입력하세요 (예: boost, decline)"
                            className="flex-1 min-w-0 px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => executeSearchForEntry(entry.id)}
                            disabled={entry.isSearchingDict}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 sm:px-3.5 py-2 text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1 shrink-0 disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
                          >
                            <Search className="w-3.5 h-3.5 shrink-0" />
                            <span>{entry.isSearchingDict ? '조회중...' : '사전 조회'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. 사전단어뜻 (영한 사전 검색 결과 & 한국어 뜻 선택) */}
                      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <h4 className="text-xs font-bold text-slate-700">
                            영한 사전 검색 결과 <span className="font-normal text-slate-500">(한국어 뜻 선택)</span>
                          </h4>
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">
                            {entry.dictResult
                              ? entry.dictResult.sourceName
                              : entry.liveCandidates.length > 0
                              ? `연관 추천 (${entry.liveCandidates.length})`
                              : '대기중'}
                          </span>
                        </div>

                        {!entry.dictResult && !entry.isSearchingDict && (
                          <>
                            {entry.liveCandidates.length > 0 ? (
                              <div className="space-y-1.5 w-full">
                                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700">
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    <span>타이핑 연관 단어 & 한국어 뜻</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400">클릭하여 선택</span>
                                </div>
                                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                  {entry.liveCandidates.map((c) => (
                                    <button
                                      key={c.word}
                                      type="button"
                                      onClick={() => handleSelectCandidateForEntry(entry.id, c.word)}
                                      className="w-full text-left p-2 rounded-lg border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/50 transition flex items-center justify-between shadow-xs group cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-black text-slate-900 group-hover:text-indigo-600 text-xs">
                                          {c.word}
                                        </span>
                                        {c.pos && (
                                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 border ${getPosBadgeColor(c.pos)}`}>
                                            {c.pos}
                                          </span>
                                        )}
                                        <span className="text-xs text-slate-600 font-medium truncate">
                                          {c.quickMeaning}
                                        </span>
                                      </div>
                                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                                        선택 ↵
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="py-6 text-center text-slate-400">
                                <p className="text-2xl mb-1">🇰🇷 📚</p>
                                <p className="text-xs font-medium text-slate-500">
                                  단어를 입력하면 연관 한국어 뜻 리스트가 여기에 바로 뜹니다.
                                </p>
                              </div>
                            )}
                          </>
                        )}

                        {entry.isSearchingDict && (
                          <div className="py-6 text-center text-indigo-600">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-indigo-600 border-t-transparent mb-1.5"></div>
                            <p className="text-xs font-semibold">영한 사전 데이터를 가져오는 중입니다...</p>
                          </div>
                        )}

                        {entry.dictResult && !entry.isSearchingDict && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-base text-slate-900">{entry.dictResult.word}</span>
                                <span className="text-xs text-indigo-600 font-mono">{entry.dictResult.phonetic}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => speakWordTTS(entry.dictResult!.word, ttsVoice)}
                                className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded-lg flex items-center gap-1 font-bold transition"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>발음</span>
                              </button>
                            </div>

                            {(() => {
                              const validMeanings = (entry.dictResult.meanings || []).filter(
                                (m) => isValidMeaningDef(m.def)
                              );

                              if (validMeanings.length === 0) {
                                return (
                                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2">
                                    <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
                                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                      <span>사전 뜻을 찾지 못했습니다. 아래에 한국어 뜻을 직접 입력해 주세요:</span>
                                    </div>
                                    <div className="flex gap-1.5 pt-0.5">
                                      <input
                                        type="text"
                                        value={entry.customMeaning || ''}
                                        onChange={(e) => updateWordEntry(entry.id, { customMeaning: e.target.value })}
                                        placeholder="직접 한국어 뜻 입력 (예: 기대치, 예상)"
                                        className="flex-1 px-3 py-1.5 text-xs bg-white text-slate-900 border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-200"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && entry.customMeaning?.trim()) {
                                            updateWordEntry(entry.id, {
                                              selectedMeaning: entry.customMeaning.trim(),
                                              selectedPos: '직접입력',
                                            });
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!entry.customMeaning?.trim()) return;
                                          updateWordEntry(entry.id, {
                                            selectedMeaning: entry.customMeaning.trim(),
                                            selectedPos: '직접입력',
                                          });
                                        }}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer transition shadow-xs"
                                      >
                                        적용
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <>
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    💡 원문 문맥에 가장 어울리는 한국어 뜻을 골라주세요:
                                  </div>

                                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {validMeanings.map((m, idx) => {
                                      const displayPos =
                                        !m.pos || m.pos === '단어' || m.pos === '품사'
                                          ? /(하다|되다|이다|다)$/.test(m.def.trim())
                                            ? '동사'
                                            : /(한|적인|로운|스런|스러운|의)$/.test(m.def.trim())
                                            ? '형용사'
                                            : /(하게|히|으로)$/.test(m.def.trim())
                                            ? '부사'
                                            : '명사'
                                          : m.pos;

                                      return (
                                        <label
                                          key={idx}
                                          onClick={() => {
                                            updateWordEntry(entry.id, {
                                              selectedMeaning: m.def,
                                              selectedPos: displayPos,
                                            });
                                          }}
                                          className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition text-xs shadow-2xs ${
                                            entry.selectedMeaning === m.def
                                              ? 'border-indigo-600 bg-indigo-50/60 font-bold'
                                              : 'border-slate-200 bg-white hover:border-indigo-300'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`meaningRadio_${entry.id}`}
                                            checked={entry.selectedMeaning === m.def}
                                            onChange={() => {
                                              updateWordEntry(entry.id, {
                                                selectedMeaning: m.def,
                                                selectedPos: displayPos,
                                              });
                                            }}
                                            className="mt-0.5 accent-indigo-600"
                                          />
                                          <div className="flex-1 flex items-center justify-between gap-1.5">
                                            <div>
                                              <span className={`inline-block px-2 py-0.5 font-bold rounded-md text-[10px] mr-1.5 border ${getPosBadgeColor(displayPos)}`}>
                                                {displayPos}
                                              </span>
                                              <span className="text-slate-900">{m.def}</span>
                                            </div>
                                            {entry.selectedMeaning === m.def && (
                                              <span className="text-[10px] text-indigo-700 bg-indigo-100/90 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold shrink-0 flex items-center gap-0.5">
                                                <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                                                <span>AI 추천 선택</span>
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>

                                  {/* 원하는 뜻이 없을 때 직접 입력 */}
                                  <details className="text-xs text-slate-600 cursor-pointer pt-1">
                                    <summary className="font-semibold text-indigo-600 hover:underline text-[11px]">
                                      원하는 뜻이 없나요? 직접 입력하기
                                    </summary>
                                    <div className="mt-1.5 flex gap-1.5">
                                      <input
                                        type="text"
                                        value={entry.customMeaning || ''}
                                        onChange={(e) => updateWordEntry(entry.id, { customMeaning: e.target.value })}
                                        placeholder="직접 한국어 뜻 입력"
                                        className="flex-1 px-2 py-1 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && entry.customMeaning?.trim()) {
                                            updateWordEntry(entry.id, {
                                              selectedMeaning: entry.customMeaning.trim(),
                                              selectedPos: '직접입력',
                                            });
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!entry.customMeaning?.trim()) return;
                                          updateWordEntry(entry.id, {
                                            selectedMeaning: entry.customMeaning.trim(),
                                            selectedPos: '직접입력',
                                          });
                                        }}
                                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer transition"
                                      >
                                        적용
                                      </button>
                                    </div>
                                  </details>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* 3 & 4. 원서 문장 & 상세 메모 (접이식 아코디언) */}
                      <details className="group bg-white rounded-xl border border-slate-200 p-3 transition">
                        <summary className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 cursor-pointer list-none select-none">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>원문 문장 및 상세 메모</span>
                            {entry.ocrDetectedNotice?.includes('⚠️') ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                ⚠️ 기본 예문 적용됨
                              </span>
                            ) : entry.context ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                ✓ 문장 연결됨
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-normal">
                                (선택 사항)
                              </span>
                            )}
                            {entry.sourceMemo && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-1.5 py-0.2 rounded-full">
                                메모 있음
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 group-open:text-indigo-600 font-medium">
                            <span className="group-open:hidden text-indigo-600 font-semibold">클릭하여 펼치기 ▾</span>
                            <span className="hidden group-open:inline">접기 ▴</span>
                          </div>
                        </summary>

                        {/* 접혀있을 때 미리보기 문장 */}
                        {entry.context && (
                          <p className="text-[11px] text-slate-500 italic truncate mt-1.5 pt-1 border-t border-slate-100 font-serif group-open:hidden">
                            &quot;{entry.context}&quot;
                          </p>
                        )}

                        {/* 펼쳤을 때 나타나는 문장 및 메모 입력란 */}
                        <div className="pt-3 mt-2.5 border-t border-slate-100 space-y-3">
                          {/* 원서 / 레포트 원문 문장 */}
                          <div>
                            <div className="flex flex-col gap-1.5 mb-2">
                              <label className="block text-xs font-bold text-slate-700">
                                원서 / 레포트 원문 문장 <span className="text-slate-400 font-normal">(권장)</span>
                              </label>
                              {entry.ocrDetectedNotice && (
                                <div
                                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg leading-relaxed animate-fade-in ${
                                    entry.ocrDetectedNotice.includes('⚠️')
                                      ? 'text-amber-800 bg-amber-50 border border-amber-200'
                                      : 'text-emerald-800 bg-emerald-50/90 border border-emerald-200'
                                  }`}
                                >
                                  {entry.ocrDetectedNotice}
                                </div>
                              )}
                            </div>

                            {/* 복수 문장 발견 시 다중 선택 체크박스 & 대표 문맥 지정 리스트 */}
                            {(() => {
                              const allFound = Array.from(
                                new Set(
                                  [
                                    ...(entry.foundCandidateSentences || []),
                                    ...(entry.candidateSentences || []),
                                    ...(entry.context ? [entry.context] : []),
                                  ]
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 5)
                                )
                              );

                              if (allFound.length <= 1) return null;

                              return (
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-300 space-y-2 mb-2">
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                                      <Sparkles className="w-3.5 h-3.5 text-slate-700" />
                                      <span>본문 내 서로 다른 {allFound.length}개 문장 발견 (등록할 문장 선택):</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateWordEntry(entry.id, {
                                            candidateSentences: [...allFound],
                                          });
                                        }}
                                        className="text-slate-800 hover:underline font-bold cursor-pointer"
                                      >
                                        전체 선택
                                      </button>
                                      <span className="text-slate-300">|</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateWordEntry(entry.id, {
                                            candidateSentences: [entry.context || allFound[0]],
                                          });
                                        }}
                                        className="text-slate-500 hover:underline font-medium cursor-pointer"
                                      >
                                        대표만 선택
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {allFound.map((sent, sIdx) => {
                                      const isPrimary = entry.context.trim() === sent.trim();
                                      const isIncluded = (entry.candidateSentences || []).includes(sent) || isPrimary;

                                      return (
                                        <div
                                          key={sIdx}
                                          className={`w-full p-2.5 rounded-xl border text-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                            isPrimary
                                              ? 'bg-slate-100 border-slate-700 ring-1 ring-slate-400/40 shadow-xs'
                                              : isIncluded
                                              ? 'bg-white border-slate-300 text-slate-800'
                                              : 'bg-slate-50/60 border-slate-200 text-slate-400'
                                          }`}
                                        >
                                          <div className="flex items-start gap-2 flex-1">
                                            {/* 체크박스: 이 문장을 단어장에 함께 저장할지 여부 */}
                                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0 mt-0.5" title="단어장에 함께 저장">
                                              <input
                                                type="checkbox"
                                                checked={isIncluded}
                                                onChange={(e) => {
                                                  const checked = e.target.checked;
                                                  let nextList = checked
                                                    ? Array.from(new Set([...(entry.candidateSentences || []), sent]))
                                                    : (entry.candidateSentences || []).filter((s) => s.trim() !== sent.trim());

                                                  // 만약 대표 문장을 체크 해제하려 할 때
                                                  let nextContext = entry.context;
                                                  if (!checked && isPrimary) {
                                                    nextContext = nextList[0] || sent;
                                                    if (!nextList.includes(nextContext)) {
                                                      nextList.push(nextContext);
                                                    }
                                                  }
                                                  updateWordEntry(entry.id, {
                                                    candidateSentences: nextList,
                                                    context: nextContext,
                                                  });
                                                }}
                                                className="w-3.5 h-3.5 text-slate-900 rounded border-slate-300 focus:ring-slate-700 cursor-pointer"
                                              />
                                              <span className="text-[10px] font-bold text-slate-500">
                                                {sIdx + 1}
                                              </span>
                                            </label>

                                            <p
                                              onClick={() => {
                                                updateWordEntry(entry.id, {
                                                  context: sent,
                                                  candidateSentences: Array.from(new Set([...(entry.candidateSentences || []), sent])),
                                                });
                                                handleTranslateContextSentence(entry.id, sent, true);
                                              }}
                                              className={`font-serif leading-relaxed line-clamp-2 cursor-pointer flex-1 ${
                                                isPrimary ? 'font-bold text-slate-900' : 'text-slate-700 hover:text-slate-900'
                                              }`}
                                              title="클릭하여 대표 문장으로 지정"
                                            >
                                              &quot;{renderHighlightedContext(sent, entry.word)}&quot;
                                            </p>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                            {isPrimary ? (
                                              <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 shadow-2xs">
                                                <span>대표 원문 📌</span>
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  updateWordEntry(entry.id, {
                                                    context: sent,
                                                    candidateSentences: Array.from(new Set([...(entry.candidateSentences || []), sent])),
                                                  });
                                                  handleTranslateContextSentence(entry.id, sent, true);
                                                }}
                                                className="text-[10px] bg-white border border-slate-300 text-slate-700 hover:bg-slate-800 hover:text-white px-2 py-0.5 rounded font-bold transition cursor-pointer"
                                              >
                                                대표로 지정
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 잘린 문장 감지 및 다음 페이지 자동 연결 안내 / 즉시 AI 완성 버튼 */}
                            {entry.context && (
                              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
                                <div className="flex items-center gap-1 min-w-0">
                                  {(entry.isTrailingCutOff || isSentenceCutOff(entry.context)) && (
                                    <span className="flex items-center gap-1.5 text-[11px] text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shadow-2xs">
                                      <Scissors className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>문장이 잘린 것 같습니다 (다음 페이지 사진을 올리면 첫 문장과 자동 연결 📄)</span>
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCompleteSentence(
                                      entry.id,
                                      entry.context,
                                      entry.word || entry.dictResult?.word || ''
                                    )
                                  }
                                  disabled={completingSentenceId === entry.id}
                                  className="text-[10px] bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-900 hover:text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 transition cursor-pointer ml-auto shadow-2xs disabled:opacity-50 shrink-0"
                                  title="다음 장 사진 없이 지금 AI로 가상 문장을 완성합니다"
                                >
                                  {completingSentenceId === entry.id ? (
                                    <>
                                      <RotateCw className="w-2.5 h-2.5 animate-spin text-slate-700" />
                                      <span>문장 완성 중...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-2.5 h-2.5 text-slate-700" />
                                      <span>지금 AI 완성 ✨</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            <textarea
                              rows={2}
                              value={entry.context}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateWordEntry(entry.id, {
                                  context: val,
                                  ocrDetectedNotice: null,
                                  isTrailingCutOff: isSentenceCutOff(val),
                                });
                              }}
                              onBlur={(e) => {
                                const text = e.target.value.trim();
                                if (text && (!entry.sentenceTranslation || entry.sentenceTranslation.trim() === '')) {
                                  handleTranslateContextSentence(entry.id, text, true);
                                }
                              }}
                              placeholder="예: It was an unspeakable tragedy that shook the entire nation. (사진이나 웹 URL을 넣으면 자동 입력됩니다)"
                              className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                            />
                          </div>

                          {/* 문장 한글 해석 (기본 자동 번역) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span>문장 한글 해석</span>
                                <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                                  기본 자동 번역 ✨
                                </span>
                              </label>
                              {entry.context?.trim() && (
                                <button
                                  type="button"
                                  onClick={() => handleTranslateContextSentence(entry.id, entry.context)}
                                  disabled={translatingSentenceId === entry.id}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="원문 문장을 자연스러운 한국어로 다시 번역합니다"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{translatingSentenceId === entry.id ? '번역 중...' : '다시 번역'}</span>
                                </button>
                              )}
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={entry.sentenceTranslation || ''}
                                onChange={(e) => updateWordEntry(entry.id, { sentenceTranslation: e.target.value })}
                                placeholder={
                                  translatingSentenceId === entry.id
                                    ? 'AI가 문장 한글 해석을 생성하고 있습니다...'
                                    : '예: 온 나라를 뒤흔든 형언할 수 없는 비극이었다. (자동 생성됨, 직접 수정 가능)'
                                }
                                className={`w-full px-3 py-1.5 text-xs bg-white text-slate-900 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                                  translatingSentenceId === entry.id ? 'border-indigo-400 bg-indigo-50/20' : 'border-slate-300'
                                }`}
                              />
                              {translatingSentenceId === entry.id && (
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-indigo-600 font-medium pointer-events-none">
                                  <RotateCw className="w-3 h-3 animate-spin" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 상세 메모 */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              상세 메모 / 페이지 <span className="text-slate-400 font-normal">(선택)</span>
                            </label>
                            <input
                              type="text"
                              value={entry.sourceMemo}
                              onChange={(e) => updateWordEntry(entry.id, { sourceMemo: e.target.value })}
                              placeholder="예: 3막 1장 45페이지, 서론 2문단"
                              className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </details>

                      {/* 단어 카드 하단 개별 저장 액션 바 */}
                      <div className="pt-3 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                        <div className="text-[11px] text-slate-500 w-full sm:w-auto truncate">
                          {isValidMeaningDef(entry.selectedMeaning) ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>선택된 뜻: <strong>{entry.selectedMeaning}</strong> ({entry.selectedPos || '단어'})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">💡 한국어 뜻을 선택하거나 직접 입력하면 단어장에 즉시 저장할 수 있습니다.</span>
                          )}
                        </div>
                        {(() => {
                          const isAnalyzing =
                            entry.isSearchingDict ||
                            entry.isAnalyzingContext ||
                            isSourceProcessing ||
                            translatingSentenceId === entry.id;

                          const canSave =
                            !isAnalyzing &&
                            Boolean(entry.dictResult?.word || entry.word.trim()) &&
                            isValidMeaningDef(entry.selectedMeaning);

                          return (
                            <button
                              type="button"
                              onClick={() => handleSaveSingleWordEntry(entry.id)}
                              disabled={!canSave}
                              className={`w-full sm:w-auto font-bold px-4 py-2 text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 ${
                                canSave
                                  ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-95'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {isAnalyzing ? (
                                <>
                                  <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                                  <span>AI 분석 중...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>&apos;{entry.word || entry.dictResult?.word || `단어 #${index + 1}`}&apos; 저장하기</span>
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}

                  {/* Add Word Entry Button */}
                  <button
                    type="button"
                    onClick={handleAddWordEntry}
                    className="w-full py-3.5 border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50/60 rounded-2xl text-indigo-700 font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs group cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                    <span>+ 단어 등록칸 추가하기 ({wordEntries.length}개 작성 중)</span>
                  </button>
                </div>

                {/* Bulk Save Section */}
                {(() => {
                  const isAnyAnalyzing =
                    wordEntries.some(
                      (e) => e.isSearchingDict || e.isAnalyzingContext || translatingSentenceId === e.id
                    ) || isSourceProcessing;

                  const readyEntries = wordEntries.filter(
                    (e) =>
                      Boolean(e.dictResult?.word || e.word.trim()) &&
                      isValidMeaningDef(e.selectedMeaning) &&
                      !e.isSearchingDict &&
                      !e.isAnalyzingContext &&
                      translatingSentenceId !== e.id &&
                      !isSourceProcessing
                  );
                  const readyCount = readyEntries.length;

                  return (
                    <div className="pt-3 mt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 text-center sm:text-left">
                        {isAnyAnalyzing ? (
                          <span className="text-indigo-600 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                            <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            <span>AI가 단어 뜻, 원문 문맥 및 한글 해석을 분석 중입니다...</span>
                          </span>
                        ) : (
                          <span>
                            작성 중인 <span className="font-bold text-indigo-600">{wordEntries.length}개</span> 등록칸 중{' '}
                            <span className="font-bold text-emerald-600">{readyCount}개</span> 단어 저장 준비 완료
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveAllWords}
                        disabled={readyCount === 0 || isAnyAnalyzing || isSavingAwaitingSource}
                        className={`w-full sm:w-auto font-bold px-6 py-2.5 text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 ${
                          readyCount > 0 && !isAnyAnalyzing
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isAnyAnalyzing || isSavingAwaitingSource ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>AI 분석 중...</span>
                          </>
                        ) : (
                          <span>
                            ⭐ [{selectedTargetBooks.length > 1 ? `${selectedTargetBooks[0]} 외 ${selectedTargetBooks.length - 1}개 (${selectedTargetBooks.length}개 단어장 동시 저장)` : (selectedTargetBooks[0] || inputBookTitle || '기본 단어장')}]에 {readyCount > 1 ? `${readyCount}개 단어 일괄 ` : '단어 '}저장하기
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </section>
            </div>

        {/* ========================================= */}
        {/* TAB 2: VOCABULARY LIST */}
        {/* ========================================= */}
        <div
          className={`w-full min-w-full shrink-0 transition-opacity duration-200 ${
            activeTab === 'list' || isSwiping || isTransitioning
              ? 'opacity-100'
              : 'h-0 max-h-0 overflow-hidden opacity-0 pointer-events-none'
          }`}
        >
          <section className="space-y-4">
            {/* Top Vocabulary Book Selector & Controls */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>내 문맥 영한 단어장</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                      총 {vocabulary.length}단어 ({availableBookTitles.length}개 단어장)
                    </span>
                  </h2>
                </div>
              </div>

              {/* 1. 단어장 다중 선택기 (복수 선택 지원 & 빠른 선택 칩 제거) */}
              <div className="space-y-2 relative" ref={bookSelectorRef}>
                <button
                  type="button"
                  onClick={() => setIsBookSelectorOpen((prev) => !prev)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/90 text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer transition flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-bold text-sm truncate text-left">
                      {isAllBooksSelected
                        ? `전체 단어장 보기 (총 ${vocabulary.length}단어)`
                        : selectedBookFilters.length === 1
                        ? `[${selectedBookFilters[0]}] (${filteredVocabulary.length}단어)`
                        : `[${selectedBookFilters[0]} 외 ${selectedBookFilters.length - 1}개] (${filteredVocabulary.length}단어)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {isAllBooksSelected ? '전체' : `${selectedBookFilters.length}개 선택`}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isBookSelectorOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* 다중 선택 드롭다운 팝오버 */}
                {isBookSelectorOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-150">
                    {/* 드롭다운 상단 바 */}
                    <div className="px-3.5 py-2.5 bg-slate-50 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>단어장 다중 선택 ({availableBookTitles.length}개)</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isAllBooksSelected) {
                              if (availableBookTitles.length > 0) {
                                setSelectedBookFilters([availableBookTitles[0]]);
                              }
                            } else {
                              setSelectedBookFilters(['all']);
                            }
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                        >
                          {isAllBooksSelected ? '단일 선택 모드' : '전체 선택'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsBookSelectorOpen(false)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 px-1 py-0.5 cursor-pointer font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* 단어장 체크박스 목록 */}
                    <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                      {/* 전체 단어장 선택 옵션 */}
                      <div
                        onClick={() => setSelectedBookFilters(['all'])}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isAllBooksSelected
                            ? 'bg-indigo-50 text-indigo-900 font-black'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isAllBooksSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                          />
                          <span>전체 단어장 보기</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                          {vocabulary.length}단어
                        </span>
                      </div>

                      {/* 개별 단어장 체크박스 목록 */}
                      {availableBookTitles.map((title) => {
                        const count = vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === title).length;
                        const isChecked = isBookSelected(title);

                        return (
                          <div
                            key={title}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                              isChecked && !isAllBooksSelected
                                ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                              <div
                                onClick={() => toggleBookCheckbox(title)}
                                className="flex items-center cursor-pointer shrink-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer pointer-events-none shrink-0"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectOnlyBook(title);
                                }}
                                title="이 단어장만 단독 보기"
                                className="text-[10px] px-1.5 py-0.5 font-bold text-slate-600 hover:text-indigo-700 bg-white border border-slate-200 hover:border-indigo-300 rounded-md transition cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                              >
                                단독
                              </button>
                              <span
                                onClick={() => toggleBookCheckbox(title)}
                                className="truncate cursor-pointer select-none flex-1 min-w-0"
                              >
                                {title}
                              </span>
                            </div>

                            <div className="flex items-center shrink-0">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                                {count}단어
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 드롭다운 하단 완료 바 */}
                    <div className="p-2.5 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600">
                      <span>
                        선택된 단어: <strong className="text-indigo-600">{filteredVocabulary.length}</strong>개
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsBookSelectorOpen(false)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
                      >
                        선택 완료
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. 문장 듣기 (왼쪽) & 퀴즈 풀기 (오른쪽) 2분할 버튼 바 */}
              <div className="pt-1 grid grid-cols-2 gap-2.5 sm:gap-3">
                {/* 왼쪽: 문장 듣기 버튼 */}
                <button
                  type="button"
                  onClick={handleToggleListenSentences}
                  className={`py-3 px-3 sm:px-4 font-black text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-[0.99] border ${
                    isListeningSentences
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border-emerald-700 shadow-emerald-200'
                  }`}
                >
                  {isListeningSentences ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span className="truncate">
                        중지 ({currentSentencePlayIdx + 1}/{sentencePlayList.length} · 반복 낭독 중 🔁)
                      </span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-200 shrink-0" />
                      <span className="truncate">🎧 문장 연속 듣기 (무한 반복)</span>
                    </>
                  )}
                </button>

                {/* 오른쪽: 퀴즈 풀기 버튼 */}
                <button
                  type="button"
                  onClick={() => startQuiz()}
                  className="py-3 px-3 sm:px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-[0.99] border border-indigo-700 shadow-indigo-200"
                >
                  <Award className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="truncate">
                    🎯 퀴즈 풀기 ({filteredVocabulary.length}단어)
                  </span>
                </button>
              </div>
            </div>

            {/* 3. 선택된 단어장의 상세 정보 카드 */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-4 sm:p-5 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    {selectedBookStats.isAll ? <Layers className="w-5 h-5" /> : <BookMarked className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                        {selectedBookStats.title}
                      </h3>
                      {selectedBookStats.isAll ? (
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
                          전체 통합
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                          선택됨
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {selectedBookStats.isAll
                        ? `총 ${availableBookTitles.length}개의 단어장에 수록된 모든 단어를 학습합니다.`
                        : `'${selectedBookStats.title}'에 등록된 단어들을 문맥과 함께 학습합니다.`}
                    </p>
                  </div>
                </div>

                {/* 랜덤 순서 표시 배지 & 다시 섞기 버튼 & 단어장 삭제 버튼 */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>랜덤 순서</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShuffleKey((k) => k + 1)}
                    className="text-[11px] font-bold text-slate-700 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                    title="단어 순서를 무작위로 다시 섞습니다"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>다시 섞기</span>
                  </button>
                  {!selectedBookStats.isAll && selectedBookFilters.length === 1 && (
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteBookModal(selectedBookFilters[0])}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-200/90 px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                      title="단어장 삭제"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>단어장 삭제</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 통계 지표 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-indigo-100/60">
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">총 수록 단어</span>
                  <span className="text-base font-black text-slate-900">{selectedBookStats.totalWords}단어</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">퀴즈 푼 횟수</span>
                  <span className="text-base font-black text-indigo-600">{selectedBookStats.totalQuiz}회</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">퀴즈 정답률</span>
                  <span
                    className={`text-base font-black ${
                      selectedBookStats.accuracy >= 80
                        ? 'text-emerald-600'
                        : selectedBookStats.accuracy >= 50
                        ? 'text-blue-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {selectedBookStats.totalQuiz > 0 ? `${selectedBookStats.accuracy}%` : '-'}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">완전 정복 단어</span>
                  <span className="text-base font-black text-emerald-600">
                    {selectedBookStats.masteredCount}단어
                  </span>
                </div>
              </div>
            </div>

            {/* 4. 단어 목록 헤더 (랜덤순) */}
            <div className="flex items-center justify-between pt-1 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>
                    {isAllBooksSelected
                      ? '전체 단어 목록 (랜덤순)'
                      : selectedBookFilters.length === 1
                      ? `[${selectedBookFilters[0]}] 단어 목록 (랜덤순)`
                      : `[${selectedBookFilters[0]} 외 ${selectedBookFilters.length - 1}개] 단어 목록 (랜덤순)`}
                  </span>
                </span>
                <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  {filteredVocabulary.length}개
                </span>
              </div>

              {!isAllBooksSelected && (
                <button
                  type="button"
                  onClick={() => setSelectedBookFilters(['all'])}
                  className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  전체 보기로 돌아가기
                </button>
              )}
            </div>

            {filteredVocabulary.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-4xl mb-3">📭</p>
                <h3 className="text-sm font-bold text-slate-700 mb-1">
                  {isAllBooksSelected
                    ? '저장된 단어가 아직 없습니다.'
                    : selectedBookFilters.length === 1
                    ? `'${selectedBookFilters[0]}' 단어장에 단어가 없습니다.`
                    : '선택된 단어장에 단어가 없습니다.'}
                </h3>
                <p className="text-xs text-slate-400 mb-4">원서를 읽다가 모르는 단어를 등록해 보세요!</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setActiveTab('add')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    첫 단어 등록하러 가기
                  </button>
                  {vocabulary.length === 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const samples = await resetWithSamples(currentUser?.id);
                        if (samples && samples.length > 0) {
                          setVocabulary(samples);
                          setSelectedBookFilters(['all']);
                          setInputBookTitle('원서 첫걸음: 어린 왕자');
                        }
                        await loadData(currentUser);
                        triggerToast('초기화 완료 🎉', '기본 3개 단어장(총 30단어)이 복원되었습니다.');
                      }}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2 rounded-xl border border-indigo-200 transition cursor-pointer shadow-2xs"
                    >
                      기본 샘플 단어(30단어) 불러오기
                    </button>
                  )}
                  {!isAllBooksSelected && selectedBookFilters.length === 1 && (
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteBookModal(selectedBookFilters[0])}
                      className="bg-rose-50 hover:bg-rose-100/80 text-rose-600 text-xs font-semibold px-4 py-2 rounded-xl border border-rose-200/80 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>이 단어장 삭제</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVocabulary.map((item) => {
                  const qCount = item.quizCount || 0;
                  const cCount = item.correctCount || 0;
                  const accuracy = qCount > 0 ? Math.round((cCount / qCount) * 100) : 0;
                  const isBeingRead = isListeningSentences && sentencePlayList[currentSentencePlayIdx]?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      id={`vocab-card-${item.id}`}
                      className={`bg-white rounded-2xl border p-5 transition flex flex-col justify-between ${
                        isBeingRead
                          ? 'border-emerald-500 ring-2 ring-emerald-400 shadow-md bg-emerald-50/25'
                          : 'border-slate-200 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Book Badge & Quiz Stats Banner */}
                        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1 truncate max-w-[180px]">
                              <BookMarked className="w-3 h-3 shrink-0" />
                              <span className="truncate">{item.bookTitle || '기본 단어장'}</span>
                            </span>
                            {isBeingRead && (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shrink-0">
                                <Volume2 className="w-3 h-3" />
                                <span>낭독 중</span>
                              </span>
                            )}
                          </div>

                          {/* Quiz Performance Stat Badge */}
                          {qCount > 0 ? (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                accuracy >= 80
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : accuracy >= 50
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              <BarChart3 className="w-3 h-3" />
                              <span>
                                {qCount}회 중 {cCount}회 정답 ({accuracy}%)
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full font-medium">
                              🎯 퀴즈 미도전
                            </span>
                          )}
                        </div>

                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-black text-slate-900">{item.word}</h3>
                              <span className="text-xs text-slate-400 font-mono">{item.phonetic}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPosBadgeColor(item.partOfSpeech)}`}>
                                {item.partOfSpeech || '단어'}
                              </span>
                              <span className="text-xs text-slate-900 font-bold">{item.selectedMeaning}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => speakWordTTS(item.word, ttsVoice)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                              title="발음 듣기"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteWord(item.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Context Sentence (대표 문장 및 누적된 문장 번갈아 보기) */}
                        {(() => {
                          const allSentences = Array.from(
                            new Set(
                              [item.contextSentence, ...(item.candidateSentences || [])]
                                .map((s) => s.trim())
                                .filter(Boolean)
                            )
                          );
                          const currentIdx =
                            listCardSentenceIdx[item.id] !== undefined
                              ? (listCardSentenceIdx[item.id] % allSentences.length)
                              : 0;
                          const viewingSentence = allSentences[currentIdx] || item.contextSentence;
                          const isViewingPrimary = viewingSentence.trim() === item.contextSentence.trim();

                          return (
                            <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {isViewingPrimary ? '대표 원문:' : '수집 원문:'}
                                  </span>
                                  {allSentences.length > 1 && (
                                    <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-full font-bold">
                                      {currentIdx + 1} / {allSentences.length}
                                    </span>
                                  )}
                                  {allSentences.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setListCardSentenceIdx((prev) => ({
                                          ...prev,
                                          [item.id]: (currentIdx + 1) % allSentences.length,
                                        }));
                                      }}
                                      className="text-[10px] bg-white border border-slate-300 text-slate-700 hover:bg-slate-800 hover:text-white px-2 py-0.5 rounded font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                      title="이 단어가 쓰인 다른 문장으로 번갈아 보기"
                                    >
                                      <RotateCw className="w-2.5 h-2.5" />
                                      <span>번갈아 보기</span>
                                    </button>
                                  )}
                                  {!isViewingPrimary && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await updateVocabularyContext(item.id, viewingSentence, currentUser?.id);
                                        await loadData(currentUser);
                                        triggerToast(
                                          '대표 원문 문장 지정 완료! 📌',
                                          '앞으로 이 문장이 대표 문장으로 설정됩니다.'
                                        );
                                      }}
                                      className="text-[10px] bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-500 hover:text-white px-1.5 py-0.5 rounded font-bold transition cursor-pointer"
                                      title="현재 보고 있는 문장을 대표 문장으로 설정"
                                    >
                                      대표로 지정 ✓
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => speakSentenceTTS(viewingSentence, ttsVoice)}
                                  className="text-[10px] text-slate-700 hover:text-slate-900 hover:underline flex items-center gap-0.5 font-bold cursor-pointer ml-auto"
                                >
                                  <Volume2 className="w-3 h-3" />
                                  <span>문장 듣기</span>
                                </button>
                              </div>
                              {/* 원문 문맥 (클릭 시 한글 해석 토글) */}
                              <div
                                onClick={() => {
                                  setShowListSentenceTransMap((prev) => ({
                                    ...prev,
                                    [item.id]: !prev[item.id],
                                  }));
                                }}
                                className="cursor-pointer group/trans p-2 -mx-1 rounded-xl hover:bg-slate-100/90 transition select-text"
                                title="문장을 클릭하면 한글 해석을 볼 수 있습니다"
                              >
                                <p className="text-xs text-slate-700 leading-relaxed font-serif">
                                  {renderHighlightedContext(viewingSentence, item.word)}
                                </p>
                                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-indigo-600 font-semibold select-none">
                                  <Languages className="w-3 h-3" />
                                  <span>
                                    {showListSentenceTransMap[item.id] ? '한글 해석 접기 ▴' : '클릭하여 한글 해석 보기 ▾'}
                                  </span>
                                </div>
                              </div>

                              {/* 한글 해석 (클릭 시 펼침) */}
                              {showListSentenceTransMap[item.id] && (
                                <div className="p-2.5 bg-white border border-indigo-100 rounded-xl text-xs text-slate-800 leading-relaxed shadow-2xs animate-fade-in font-sans">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
                                      <Languages className="w-3 h-3 text-indigo-600" />
                                      <span>한글 해석</span>
                                    </span>
                                    {!item.sentenceTranslation && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAutoTranslateAndSaveListItem(item.id, viewingSentence);
                                        }}
                                        disabled={translatingListItemId === item.id}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      >
                                        <Sparkles className="w-2.5 h-2.5" />
                                        <span>{translatingListItemId === item.id ? '번역 중...' : 'AI 자동 번역'}</span>
                                      </button>
                                    )}
                                  </div>
                                  {item.sentenceTranslation ? (
                                    <p className="text-slate-800">{item.sentenceTranslation}</p>
                                  ) : (
                                    <p className="text-slate-400 text-[11px] italic">
                                      등록된 한글 해석이 없습니다. 상단 [AI 자동 번역]을 누르면 즉시 번역됩니다.
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* 전체 수집된 문맥 목록 (접이식) */}
                              {allSentences.length > 1 && (
                                <details className="pt-2 border-t border-slate-200/80 text-xs text-slate-600 group">
                                  <summary className="cursor-pointer font-bold text-slate-800 hover:text-slate-900 flex items-center gap-1 text-[11px]">
                                    <Sparkles className="w-3 h-3 text-slate-700" />
                                    <span>수집된 전체 문맥 ({allSentences.length}개 보관됨)</span>
                                  </summary>
                                  <div className="mt-2 space-y-1.5 pl-1.5 border-l-2 border-slate-300">
                                    {allSentences.map((sent, sIdx) => {
                                      const isCurrentViewing = viewingSentence.trim() === sent.trim();
                                      const isSentPrimary = item.contextSentence.trim() === sent.trim();
                                      return (
                                        <div
                                          key={sIdx}
                                          className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                            isCurrentViewing
                                              ? 'bg-slate-100 border-slate-400 font-bold text-slate-900 shadow-2xs'
                                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                          }`}
                                        >
                                          <p className="flex-1 font-serif text-[11px] leading-relaxed">
                                            &quot;{sent}&quot;
                                          </p>
                                          <div className="flex items-center gap-1 shrink-0 self-start sm:self-auto">
                                            {isSentPrimary && (
                                              <span className="text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded font-bold">
                                                대표 원문
                                              </span>
                                            )}
                                            {!isCurrentViewing && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setListCardSentenceIdx((prev) => ({
                                                    ...prev,
                                                    [item.id]: sIdx,
                                                  }));
                                                }}
                                                className="text-[10px] bg-white border border-slate-300 text-slate-600 hover:border-slate-800 hover:text-slate-900 px-2 py-0.5 rounded font-medium transition cursor-pointer"
                                              >
                                                보기
                                              </button>
                                            )}
                                            {!isSentPrimary && (
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  await updateVocabularyContext(item.id, sent, currentUser?.id);
                                                  await loadData(currentUser);
                                                  triggerToast(
                                                    '대표 원문 문장 변경 완료! 📖',
                                                    '앞으로 퀴즈 복습 시 변경된 문장이 우선 출제됩니다.'
                                                  );
                                                }}
                                                className="text-[10px] bg-white border border-slate-300 text-slate-700 hover:bg-slate-800 hover:text-white px-2 py-0.5 rounded font-bold transition cursor-pointer"
                                              >
                                                대표로 변경
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>메모: {item.sourceMemo || '원서'}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ========================================= */}
        {/* TAB 3: 5-CHOICE QUIZ */}
        {/* ========================================= */}
        <div
          className={`w-full min-w-full shrink-0 transition-opacity duration-200 ${
            activeTab === 'quiz' || isSwiping || isTransitioning
              ? 'opacity-100'
              : 'h-0 max-h-0 overflow-hidden opacity-0 pointer-events-none'
          }`}
        >
          <section className="max-w-2xl mx-auto w-full min-w-0 space-y-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
              {/* Quiz Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-200 font-bold">
                    문제 {Math.min(currentQuizIndex + 1, quizList.length)} / {quizList.length}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 font-bold">정답: {quizScore}개</span>
                </div>
              </div>

              {/* Quiz Body */}
              <div className="p-6">
                {!isLoaded ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">단어장을 불러오는 중입니다...</p>
                  </div>
                ) : !isQuizFinished && currentQuizItem ? (
                  <>
                    <div className="text-center py-3 border-b border-slate-100">
                      <div className="mb-2 flex items-center justify-center gap-1.5 flex-wrap">
                        <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center">
                          <span>{currentQuizItem.bookTitle || '기본 단어장'}</span>
                        </span>
                        {/* 학습 상태 태그 배지들 */}
                        {(currentQuizItem.wrongCount || 0) > 0 && (
                          <span className="text-[11px] bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border border-rose-100">
                            🔥 오답 {currentQuizItem.wrongCount}회
                          </span>
                        )}
                        {(currentQuizItem.consecutiveCorrect || 0) >= 2 && (
                          <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border border-emerald-100">
                            🎯 {currentQuizItem.consecutiveCorrect}연속 정답
                          </span>
                        )}
                        {(() => {
                          const isNew =
                            currentQuizItem.date &&
                            (Date.now() - new Date(currentQuizItem.date).getTime()) / (1000 * 60 * 60 * 24) < 2;
                          if (isNew) {
                            return (
                              <span className="text-[11px] bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border border-amber-100">
                                ✨ 신규 단어
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase mb-1 block">
                        다음 영어 단어의 알맞은 한국어 뜻을 고르세요
                      </span>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                        {currentQuizItem.word}
                      </h3>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">
                          {currentQuizItem.phonetic || `/${currentQuizItem.word}/`}
                        </span>
                        <button
                          onClick={() => speakWordTTS(currentQuizItem.word, ttsVoice)}
                          className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded-md flex items-center gap-1 font-semibold transition"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>단어 듣기</span>
                        </button>
                      </div>
                    </div>

                    {/* 5 Options: 정답 선택 전에는 5개 선지 표시, 선택 후에는 깔끔하게 사라짐 */}
                    {!quizAnswerState.answered ? (
                      <div className="mt-5 space-y-2.5">
                        {quizOptions.map((opt, idx) => {
                          const labels = ['①', '②', '③', '④', '⑤'];
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectOption(opt)}
                              className="quiz-option-btn w-full text-left p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/40 text-xs font-bold text-slate-900 transition flex items-center gap-3 shadow-sm active:scale-[0.99]"
                            >
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-xs border border-slate-200 shrink-0">
                                {labels[idx]}
                              </span>
                              <span className="flex-1">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* 정답 선택 후: 선지들은 사라지고 원문 문맥 + 원어민 발음 + 다음 문제만 시원하게 표시 */
                      <div className="mt-5 space-y-4 animate-fade-in w-full">
                        {/* Status Result Banner */}
                        <div
                          className={`p-4 rounded-2xl flex items-center justify-between text-white shadow-md ${
                            quizAnswerState.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {quizAnswerState.isCorrect ? (
                              <CheckCircle2 className="w-6 h-6 shrink-0" />
                            ) : (
                              <AlertCircle className="w-6 h-6 shrink-0" />
                            )}
                            <div>
                              <div className="text-base font-black leading-tight">
                                {quizAnswerState.isCorrect ? '정답입니다! 🎉' : '오답입니다! 💡'}
                              </div>
                              <div className="text-xs text-white/90 mt-0.5">
                                알맞은 뜻: <span className="font-bold underline decoration-white/40">{currentQuizItem.selectedMeaning}</span>
                              </div>
                            </div>
                          </div>
                          {quizAnswerState.isCorrect && (
                            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-xl font-mono font-bold">+1 Point</span>
                          )}
                        </div>

                        {/* Context Sentence Card */}
                        {(() => {
                          const currentQuizAllSentences = (
                            currentQuizItem.candidateSentences && currentQuizItem.candidateSentences.length > 0
                              ? currentQuizItem.candidateSentences
                              : [currentQuizItem.contextSentence]
                          ).filter(Boolean);
                          const activeSentence = quizActiveSentence || currentQuizItem.contextSentence;

                          return (
                            <div className="bg-amber-50/95 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2.5">
                              {currentQuizAllSentences.length > 1 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] bg-amber-200/90 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                                    문장 {quizSentenceIdx + 1}/{currentQuizAllSentences.length}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextIdx = (quizSentenceIdx + 1) % currentQuizAllSentences.length;
                                      setQuizSentenceIdx(nextIdx);
                                      const nextSentence = currentQuizAllSentences[nextIdx];
                                      setQuizActiveSentence(nextSentence);
                                      speakSentenceTTS(nextSentence, ttsVoice);
                                    }}
                                    className="text-xs bg-amber-200/90 hover:bg-amber-300 text-amber-900 font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 transition shadow-2xs cursor-pointer active:scale-95"
                                    title="이 단어가 쓰인 다른 원문 문맥으로 번갈아가며 봅니다"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    <span>번갈아 보기</span>
                                  </button>
                                </div>
                              )}
                              {/* 클릭 가능한 원문 문장 영역 */}
                              <div
                                onClick={() => setShowQuizSentenceTranslation((prev) => !prev)}
                                className="cursor-pointer group/quiz-trans p-2.5 -mx-2 rounded-xl hover:bg-amber-100/70 transition select-text"
                                title="문장을 누르면 한글 해석을 볼 수 있습니다"
                              >
                                <p className="text-base text-slate-800 leading-relaxed font-serif">
                                  {renderHighlightedContext(activeSentence, currentQuizItem.word)}
                                </p>
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-800 font-semibold select-none">
                                  <Languages className="w-3.5 h-3.5" />
                                  <span>
                                    {showQuizSentenceTranslation ? '한글 해석 접기 ▴' : '한글 해석 보기 ▾'}
                                  </span>
                                </div>
                              </div>

                              {/* 펼쳐지는 한글 해석 카드 */}
                              {showQuizSentenceTranslation && (
                                <div className="p-3.5 bg-white/95 border border-amber-200/90 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed shadow-xs animate-fade-in font-sans">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                      <Languages className="w-3.5 h-3.5 text-amber-700" />
                                      <span>한글 해석</span>
                                    </span>
                                    {!currentQuizItem.sentenceTranslation && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAutoTranslateQuizItem(currentQuizItem.id, activeSentence);
                                        }}
                                        disabled={translatingListItemId === currentQuizItem.id}
                                        className="text-[10px] text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      >
                                        <Sparkles className="w-2.5 h-2.5" />
                                        <span>{translatingListItemId === currentQuizItem.id ? '번역 중...' : 'AI 자동 번역'}</span>
                                      </button>
                                    )}
                                  </div>
                                  {currentQuizItem.sentenceTranslation ? (
                                    <p className="text-slate-800 font-medium">{currentQuizItem.sentenceTranslation}</p>
                                  ) : (
                                    <p className="text-slate-400 text-xs italic">
                                      등록된 한글 해석이 없습니다. 상단 [AI 자동 번역]을 누르면 즉시 번역됩니다.
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-amber-200/60 text-xs text-slate-500">
                                <span className="truncate min-w-0">출처: {currentQuizItem.sourceMemo || '원서'}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => speakSentenceTTS(activeSentence, ttsVoice)}
                                    className="text-xs bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer whitespace-nowrap"
                                  >
                                    <Volume2 className="w-3 h-3 shrink-0" />
                                    <span>문장 듣기</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => speakWordTTS(currentQuizItem.word, ttsVoice)}
                                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer whitespace-nowrap"
                                  >
                                    <Volume2 className="w-3 h-3 shrink-0" />
                                    <span>단어 듣기</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Big Next Button */}
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={handleNextQuestion}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
                          >
                            <span>다음 문제 풀기</span>
                            <span>➔</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10 space-y-4">
                    <p className="text-5xl">🏆</p>
                    <h3 className="text-xl font-black text-slate-900">퀴즈 완료!</h3>
                    <p className="text-xs text-slate-600">
                      총 <strong>{quizList.length}</strong>문제 중{' '}
                      <strong className="text-indigo-600 text-base font-black">{quizScore}</strong>문제를 맞히셨습니다.
                    </p>
                    <div className="pt-4 flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => startQuiz(selectedBookFilters)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                      >
                        다시 풀기 🔄
                      </button>
                      <button
                        onClick={() => setActiveTab('list')}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                      >
                        단어장 확인
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200/80 bg-white text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-slate-500">
            <p>© {new Date().getFullYear()} 원서. 문장. 단어 (divivid). All rights reserved.</p>
            <span className="text-[11px] font-mono text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              {APP_BUILD_VERSION}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600">
            <a href="https://divivid.com" target="_blank" rel="noreferrer" className="hover:text-indigo-600 transition">
              divivid.com
            </a>
            <span>•</span>
            <a href="/privacy" className="hover:text-indigo-600 transition">
              개인정보처리방침
            </a>
            <span>•</span>
            <a href="/terms" className="hover:text-indigo-600 transition">
              서비스 이용약관
            </a>
          </div>
        </div>
      </footer>

      {/* Web Page URL & Article Paste Unified Modal */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-indigo-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                    원문 가져오기 (URL / 본문 글 통합)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    웹 주소(URL)나 복사한 기사 본문을 넣으면 자동 감지해 불러옵니다
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Primary Smart Clipboard Paste Button */}
            <div className="mt-3 shrink-0">
              <button
                type="button"
                onClick={handleClipboardPasteSmart}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                title="복사한 내용이 URL이면 기사를 불러오고, 글이면 본문으로 자동 등록합니다"
              >
                <ClipboardPaste className="w-4 h-4 text-amber-300 shrink-0" />
                <span>📋 클립보드에서 바로 붙여넣기 (원터치 자동 판별)</span>
              </button>
            </div>

            {/* Modal Body: Unified Input */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    웹 주소(URL) 또는 기사 본문 텍스트
                  </label>
                  <div className="flex items-center gap-2">
                    {inputSourceText && (
                      <button
                        type="button"
                        onClick={() => setInputSourceText('')}
                        className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold cursor-pointer"
                      >
                        지우기
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={inputSourceText}
                  onChange={(e) => {
                    setInputSourceText(e.target.value);
                    setUrlScrapeError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleUnifiedSubmit();
                    }
                  }}
                  placeholder="웹페이지 주소(URL) 또는 복사한 기사 본문을 여기에 편하게 넣으세요.&#10;&#10;• 웹 URL 입력: 예) https://www.bbc.com/news/... -> 기사 본문 자동 수집&#10;• 기사 글 붙여넣기: 복사한 뉴스/책 내용 -> 광고 자동 삭제 후 본문 등록"
                  className="w-full px-3.5 py-3 bg-white text-slate-900 border border-slate-300 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-serif leading-relaxed"
                />
              </div>

              {/* Sample Quick Chips */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 mb-1.5 block">빠른 테스트 추천 URL:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'BBC World News', url: 'https://www.bbc.com/news' },
                    { label: 'Wikipedia (AI)', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
                    { label: 'TechCrunch', url: 'https://techcrunch.com' },
                  ].map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => {
                        setInputSourceText(sample.url);
                        setUrlScrapeError(null);
                      }}
                      className="text-[10px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Remove Ads Option */}
              <label className="flex items-center gap-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRemoveAds}
                  onChange={(e) => setAutoRemoveAds(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                <div className="flex-1 text-xs">
                  <span className="font-bold text-indigo-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>중간 광고 및 배너 안내 문구 자동 삭제 & 정제</span>
                  </span>
                  <p className="text-[10px] text-slate-500">
                    기사 복사 시 포함된 광고, 소셜 링크, 구독 권유 문구를 깨끗하게 정제합니다.
                  </p>
                </div>
              </label>

              {urlScrapeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{urlScrapeError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                취소
              </button>

              <button
                type="button"
                onClick={handleUnifiedSubmit}
                disabled={isUrlScraping || isCleaningPastedText || !inputSourceText.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isUrlScraping || isCleaningPastedText ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>원문 분석 및 정제 중...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    <span>원문 불러오기</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word Selection from Loaded Text Modal (원문에서 단어 직접 클릭 선택 & 원본 사진 대조 모달) */}
      {isWordSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-indigo-100 flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                    원문에서 모르는 단어 선택
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    본문 속 단어를 터치하거나 사진을 보며 단어장에 담으세요
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWordSelectModalOpen(false);
                  setEditingWordIdx(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Top Toolbar: Tabs (Split vs Text vs Image) & AI Clean Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-1 shrink-0 border-b border-slate-100/80">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                {(currentSourceImageRef.current || currentSourceImage) && (
                  <button
                    type="button"
                    onClick={() => setPickerTab('split')}
                    className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      pickerTab === 'split'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>📷+📝 함께보기</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPickerTab('text')}
                  className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    pickerTab === 'text' || (!(currentSourceImageRef.current || currentSourceImage) && pickerTab === 'split')
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📝 텍스트만
                </button>
                {(currentSourceImageRef.current || currentSourceImage) && (
                  <button
                    type="button"
                    onClick={() => setPickerTab('image')}
                    className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      pickerTab === 'image'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>🔍 사진 확대</span>
                  </button>
                )}
              </div>

              {(currentSourceImageRef.current || currentSourceImage || pageOcrText) && (
                <button
                  type="button"
                  onClick={handleAiCleanPageText}
                  disabled={isCleaningWithAI}
                  className="text-[11px] bg-slate-100 border border-slate-300 text-slate-800 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Tesseract 인식 오타나 깨진 글자를 Gemini AI로 1~2초 만에 깔끔하게 복원합니다"
                >
                  <Sparkles className={`w-3 h-3 ${isCleaningWithAI ? 'animate-spin' : 'text-slate-600'}`} />
                  <span>{isCleaningWithAI ? 'AI 복원 중...' : '✨ AI 본문 복원'}</span>
                </button>
              )}
            </div>

            {/* Modal Body: Independent Split-Scroll between Pinned Photo and Text Tokens */}
            <div className="flex-1 flex flex-col overflow-hidden pr-0.5 py-1 min-h-[180px] gap-2">
              {/* 원본 사진 영역 (함께보기 시 상단 고정 + 독립 스크롤 / 사진 확대 시 전체 스크롤) */}
              {(pickerTab === 'image' || pickerTab === 'split') && (sourceImages.length > 0 || currentSourceImageRef.current || currentSourceImage) && (
                <div className={pickerTab === 'image' ? 'flex-1 flex flex-col min-h-0 space-y-1.5' : 'shrink-0 space-y-1'}>
                  <div
                    className={`p-1.5 bg-slate-900/5 rounded-2xl border border-slate-200/80 overflow-y-auto overflow-x-auto space-y-2 ${
                      pickerTab === 'image' ? 'flex-1 max-h-[52vh]' : 'max-h-[26vh]'
                    }`}
                  >
                    {(sourceImages.length > 0 ? sourceImages : [currentSourceImageRef.current || currentSourceImage]).map((img, iIdx) => (
                      img?.base64 && (
                        <div key={iIdx} className="space-y-1">
                          {sourceImages.length > 1 && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                              페이지 {iIdx + 1}
                            </span>
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`}
                            alt={`도서 페이지 사진 ${iIdx + 1}`}
                            className="w-full h-auto block rounded-xl shadow-xs"
                          />
                        </div>
                      )
                    ))}
                  </div>
                  {pickerTab === 'image' && (
                    <p className="text-[11px] text-slate-500 text-center leading-normal shrink-0">
                      💡 책 사진 속 단어 위치를 위아래로 스크롤하며 확인하세요. 오인식된 단어는 선택해도 <strong className="text-indigo-600">AI가 문맥을 보고 원래 단어로 자동 복원</strong>합니다.
                    </p>
                  )}
                </div>
              )}

              {/* 텍스트 토큰 선택 영역 (독립 스크롤 영역) */}
              {pickerTab !== 'image' && (
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-[13px] sm:text-[14px] leading-relaxed text-slate-800 font-serif whitespace-pre-wrap select-none">
                  {textTokens.length > 0 ? (
                    textTokens.map((token, idx) => {
                      if (!token.isWord || !token.cleanWord) {
                        return <span key={idx}>{token.raw}</span>;
                      }

                      const clean = token.cleanWord;
                      const isSelected = selectedWordsFromText.includes(clean);
                      const isAlreadyAdded = wordEntries.some(
                        (e) => e.word.trim().toLowerCase() === clean
                      );

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleWordFromText(clean, token.contextSnippet)}
                          className={`inline font-sans rounded px-0.5 py-0 text-xs sm:text-[13px] transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold px-1 py-0.5 shadow-xs'
                              : isAlreadyAdded
                              ? 'bg-emerald-100 text-emerald-800 font-medium px-1 py-0.5'
                              : 'text-slate-900 underline decoration-indigo-300 decoration-1 underline-offset-2 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                          title={isAlreadyAdded ? '이미 단어칸에 등록됨' : '클릭하여 선택 (깨진 글자도 AI가 문맥으로 자동 복원합니다)'}
                        >
                          {token.raw}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-center text-slate-400 py-8">
                      불러온 본문 텍스트가 없습니다. 사진이나 URL을 먼저 불러와 주세요.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions / Selected Words Chips & Direct Input */}
            <div className="pt-2.5 border-t border-slate-100 mt-2 space-y-2 shrink-0">
              {/* Selected Words Chips Bar Header */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span>선택한 단어</span>
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black">
                    {selectedWordsFromText.length}
                  </span>
                </span>
                {selectedWordsFromText.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWordsFromText([]);
                      setEditingWordIdx(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-500 font-medium transition cursor-pointer"
                  >
                    전체 해제
                  </button>
                )}
              </div>

              {/* Word Chips (With Inline Edit ✏️ and Delete ✕) */}
              {selectedWordsFromText.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
                  {selectedWordsFromText.map((word, idx) => {
                    const isEditing = editingWordIdx === idx;
                    const lemma = extractLemmaCandidate(word);
                    const isChanged = lemma.toLowerCase() !== word.toLowerCase();

                    if (isEditing) {
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border-2 border-indigo-500 rounded-lg shadow-xs"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingWordVal}
                            onChange={(e) => setEditingWordVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditWord(idx);
                              if (e.key === 'Escape') setEditingWordIdx(null);
                            }}
                            className="text-xs font-bold text-slate-900 outline-none w-24"
                            placeholder="단어 수정..."
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditWord(idx)}
                            className="text-[11px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold cursor-pointer hover:bg-indigo-700"
                          >
                            확인
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWordIdx(null)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 px-1"
                          >
                            취소
                          </button>
                        </div>
                      );
                    }

                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold shadow-2xs"
                      >
                        {isChanged ? (
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400 line-through text-[11px]">{word}</span>
                            <span className="text-indigo-600 font-bold">{lemma}</span>
                          </span>
                        ) : (
                          <span>{word}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditWord(idx, word)}
                          className="text-slate-400 hover:text-indigo-600 text-[11px] transition cursor-pointer"
                          title="오인식된 단어 철자 수정"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleWordFromText(word)}
                          className="text-indigo-400 hover:text-rose-500 text-[10px] font-bold cursor-pointer"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  위 본문에서 단어를 탭하거나, 아래 입력창에 직접 입력하세요.
                </p>
              )}

              {/* Direct Word Input Bar (사진 보면서 단어 직접 추가) */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  value={manualWordInput}
                  onChange={(e) => setManualWordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddManualWord();
                    }
                  }}
                  placeholder="사진 보며 단어 직접 입력 (예: questions)..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 outline-none text-slate-800 transition"
                />
                <button
                  type="button"
                  onClick={handleAddManualWord}
                  disabled={!manualWordInput.trim()}
                  className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                >
                  + 직접 추가
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsWordSelectModalOpen(false);
                    setEditingWordIdx(null);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  disabled={selectedWordsFromText.length === 0}
                  onClick={handleApplySelectedWords}
                  className={`flex-[2] py-2.5 px-4 rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center gap-1.5 ${
                    selectedWordsFromText.length > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {selectedWordsFromText.length > 0
                      ? `선택한 단어 ${selectedWordsFromText.length}개 담기`
                      : '단어를 터치하거나 입력해 담으세요'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Personal & App Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    개인별 설정 & 앱 환경
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    프로필 변경, AI 연동 및 데이터 관리
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="px-5 pt-3 border-b border-slate-100 flex gap-1">
              <button
                type="button"
                onClick={() => setSettingsTab('preferences')}
                className={`flex-1 py-2.5 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  settingsTab === 'preferences'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>퀴즈 & 환경</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('profile')}
                className={`flex-1 py-2.5 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  settingsTab === 'profile'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>프로필</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('ai')}
                className={`flex-1 py-2.5 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  settingsTab === 'ai'
                    ? 'border-brand-600 text-brand-700 bg-brand-50/40 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-brand-600" />
                <span>AI 연동</span>
                {geminiApiKey && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                )}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setSettingsTab('admin')}
                  className={`flex-1 py-2.5 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    settingsTab === 'admin'
                      ? 'border-purple-600 text-purple-700 bg-purple-50/40 rounded-t-xl'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="text-xs">👑</span>
                  <span>서버 API 관제</span>
                  <span className="w-2 h-2 rounded-full bg-purple-500 ring-2 ring-white" />
                </button>
              )}
            </div>

            {/* Tab Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* TAB: 프로필 설정 */}
              {settingsTab === 'profile' && (
                <div className="space-y-4 animate-fade-in">
                  {!currentUser && (
                    <div className="p-3 bg-gradient-to-r from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100 flex items-center justify-between gap-2.5">
                      <div className="text-[11px] text-indigo-950 font-medium leading-snug">
                        <span className="font-bold text-indigo-700 block">💡 게스트 모드 안내</span>
                        로그인하시면 프로필 사진과 표시 이름이 클라우드에 영구 백업되어 모든 기기에 동기화됩니다.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          setIsAuthModalOpen(true);
                        }}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer shadow-xs"
                      >
                        로그인
                      </button>
                    </div>
                  )}

                  {/* Avatar Upload & Compression Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center gap-4">
                      {/* Avatar Preview with Camera Trigger */}
                      <div className="relative shrink-0">
                        <div className="w-18 h-18 rounded-full ring-4 ring-white shadow-md overflow-hidden bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white text-2xl font-bold">
                          {(pendingAvatarDataUrl !== null ? pendingAvatarDataUrl : effectiveAvatar) ? (
                            <img
                              src={(pendingAvatarDataUrl !== null ? pendingAvatarDataUrl : effectiveAvatar)!}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{(profileInputName || effectiveDisplayName || 'U')[0].toUpperCase()}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => avatarFileInputRef.current?.click()}
                          disabled={isCompressingAvatar}
                          className="absolute -bottom-1 -right-1 w-7 h-7 bg-slate-900 hover:bg-slate-800 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition active:scale-95 border-2 border-white"
                          title="사진 변경하기"
                        >
                          {isCompressingAvatar ? (
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Camera className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Avatar Details & Actions */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">프로필 사진</span>
                          {avatarCompressionInfo && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>압축 {avatarCompressionInfo.sizeKb}KB</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          선택한 사진은 기기 내에서 128x128px 초경량 WebP로 자동 압축 저장됩니다.
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => avatarFileInputRef.current?.click()}
                            disabled={isCompressingAvatar}
                            className="text-[11px] bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Upload className="w-3 h-3" />
                            <span>사진 업로드</span>
                          </button>
                          {currentUser?.user_metadata?.avatar_url && (
                            <button
                              type="button"
                              onClick={handleResetAvatarToGoogle}
                              className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-2 py-1 rounded-lg transition cursor-pointer"
                              title="Google 계정 원래 사진으로 복원"
                            >
                              Google 사진
                            </button>
                          )}
                          {(pendingAvatarDataUrl !== null ? pendingAvatarDataUrl : effectiveAvatar) && (
                            <button
                              type="button"
                              onClick={handleRemoveAvatar}
                              className="text-[11px] text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg font-semibold transition cursor-pointer"
                            >
                              사진 삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hidden File Input */}
                    <input
                      type="file"
                      ref={avatarFileInputRef}
                      onChange={handleAvatarFileSelect}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Supabase 500MB Quota Zero Usage & Cross-device Sync Notice */}
                    <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-indigo-900 leading-relaxed">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">모든 기기(폰·패드·PC) 자동 동기화 & 500MB 한도 0MB 소모</span>
                        <p className="text-slate-600 text-[10.5px] mt-0.5">
                          사진을 128x128px 초경량 WebP(3~5KB)로 압축한 뒤 로그인 계정(Auth)에 안전하게 동기화합니다. 별도의 스토리지 버킷을 쓰지 않으므로 <strong>Supabase 500MB 스토리지 용량을 0MB 소모</strong>하면서도 폰과 태블릿 어디서든 동일한 사진이 나타납니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Display Name Input */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-800">
                      표시 이름 (닉네임)
                    </label>
                    <input
                      type="text"
                      value={profileInputName}
                      onChange={(e) => setProfileInputName(e.target.value)}
                      placeholder="단어장에 표시할 닉네임 입력"
                      maxLength={30}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      상단 프로필 및 개인 단어장에 표시되는 이름입니다.
                    </p>
                  </div>

                  {/* Account Status Info */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                        {currentUser ? <Cloud className="w-4 h-4 text-emerald-600" /> : <UserIcon className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {currentUser ? (currentUser.email || 'Google 연동 계정') : '게스트 사용자'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {currentUser ? '클라우드 실시간 동기화 활성화됨' : '현재 로컬 브라우저 저장 모드'}
                        </p>
                      </div>
                    </div>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          handleGoogleLoginClick();
                        }}
                        className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer shrink-0"
                      >
                        Google 로그인
                      </button>
                    )}
                  </div>

                  {/* Profile Save Button */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>저장 중...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>변경사항 저장</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Google Gemini AI 연동 */}
              {settingsTab === 'ai' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Status Banner */}
                  <div className="bg-brand-50/70 rounded-2xl p-4 border border-brand-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-xs text-brand-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-slate-700" />
                        <span>Google Gemini AI 비전 & 문맥 분석</span>
                      </h4>
                      {geminiApiKey || isServerGeminiReady ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>{geminiApiKey ? '개인 키 연동됨' : '서버 AI 활성화됨 🚀'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          미등록 (기본 모드)
                        </span>
                      )}
                    </div>
                    {aiQuotaExceededNotice && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-[11.5px] text-amber-950 space-y-1 shadow-2xs">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-extrabold flex items-center gap-1.5 text-amber-900">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              오늘의 무료 서버 AI 한도
                              {aiQuotaExceededNotice.limit
                                ? `(${aiQuotaExceededNotice.used ?? aiQuotaExceededNotice.limit}/${aiQuotaExceededNotice.limit}회)`
                                : ''}
                              를 모두 사용했습니다
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setAiQuotaExceededNotice(null)}
                            className="text-amber-600 hover:text-amber-900 text-xs font-bold px-1 cursor-pointer"
                            aria-label="안내 닫기"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-900/90 leading-relaxed pl-5.5">
                          아래 안내를 따라 본인 무료 Google API 키를 등록(30초 완료)하시면 <strong>일 1,500회 + 비상 서버 100회</strong>로 바로 이어서 사용하실 수 있습니다.
                        </p>
                      </div>
                    )}
                    {isServerGeminiReady && !geminiApiKey && (
                      <div className="p-2.5 bg-emerald-50/90 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 font-medium leading-relaxed">
                        ✨ <strong>서버 전역 Gemini AI가 활성화되어 있습니다.</strong><br />
                        Vercel 환경 변수가 감지되어 개인 키를 입력하지 않아도 책 사진 고정밀 OCR 및 밑줄/동그라미 단어 자동 등록이 모든 기기에서 즉시 작동합니다.
                      </div>
                    )}
                    <ul className="space-y-1.5 text-[11px] text-slate-700 leading-relaxed pl-1 pt-1">
                      <li className="flex items-start gap-1.5">
                        <span className="text-brand-600 font-bold">1.</span>
                        <span><strong>사진 오타·줄바꿈 100% 자동 교정</strong>: 모바일 카메라로 대충 찍어도 흐릿한 글자, 잘린 하이픈(con- / dition)을 자연스러운 문맥으로 완벽 복원합니다.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-brand-600 font-bold">2.</span>
                        <span><strong>문맥 속 변화형 자동 감지</strong>: 단어를 원형(party, run)으로 입력해도 책 속의 복수형(parties), 과거형(ran), 분사형 등을 AI가 스스로 찾아냅니다.</span>
                      </li>
                    </ul>
                    {/* Daily Free AI Quota Policy Card */}
                    <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11.5px] font-extrabold text-indigo-950">📊 일일 무료 AI 사용 한도 안내</p>
                        <span className="text-[10px] font-semibold text-indigo-700/80">매일 자정(KST) 초기화</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                        <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${!currentUser && !geminiApiKey ? 'bg-white border-indigo-400 shadow-2xs font-bold text-indigo-950' : 'bg-white/70 border-indigo-100 text-slate-700'}`}>
                          <span className="flex items-center gap-1.5">
                            <span>비로그인 (게스트)</span>
                            {!currentUser && !geminiApiKey && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold">현재 적용</span>
                            )}
                          </span>
                          <span className="font-bold text-slate-800 whitespace-nowrap">서버 AI 20회/일</span>
                        </div>
                        <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${currentUser && !geminiApiKey ? 'bg-white border-indigo-400 shadow-2xs font-bold text-indigo-950' : 'bg-white/70 border-indigo-100 text-slate-700'}`}>
                          <span className="flex items-center gap-1.5">
                            <span>로그인 회원 (키 미등록)</span>
                            {currentUser && !geminiApiKey && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold">현재 적용</span>
                            )}
                          </span>
                          <span className="font-bold text-slate-800 whitespace-nowrap">서버 AI 50회/일</span>
                        </div>
                        <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${geminiApiKey ? 'bg-emerald-50 border-emerald-400 shadow-2xs font-bold text-emerald-950' : 'bg-white/70 border-indigo-100 text-slate-700'}`}>
                          <span className="flex items-center gap-1.5">
                            <span>개인 키 등록 회원</span>
                            {geminiApiKey && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold">현재 적용</span>
                            )}
                          </span>
                          <span className="font-bold text-emerald-700 text-right leading-snug whitespace-nowrap">
                            본인 키 1,500회/일<br />+ 서버 AI 100회/일
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-indigo-900/75 leading-relaxed">
                        💡 개인 무료 키를 등록하면 본인 한도(일 1,500회)가 우선 사용되며, 초과 시에도 비상 서버 키(일 100회)로 자동 이어집니다.
                      </p>
                    </div>
                  </div>

                  {/* API Key Form */}
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span>Gemini API Key 등록 (신용카드 불필요 · 평생 무료)</span>
                      </label>
                      <div className="flex justify-end">
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-800 font-bold underline"
                        >
                          <span>무료 키 발급 (Google)</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1 leading-relaxed">
                        <p className="font-bold text-slate-700">📌 무료 API 키 발급 방법 (30초 완료)</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
                          <li>위 <strong>무료 키 발급 (Google)</strong>을 눌러 Google 계정으로 로그인합니다.</li>
                          <li><strong>API 키 만들기 (Create API key)</strong> 버튼을 눌러 키를 생성합니다.</li>
                          <li>생성된 키를 복사해 아래 칸에 붙여넣고 <strong>[연동 및 테스트]</strong>를 누르면 완료!</li>
                        </ol>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full min-w-0">
                      <input
                        type="password"
                        value={geminiKeyInput}
                        onChange={(e) => {
                          setGeminiKeyInput(e.target.value);
                          setKeyTestStatus(null);
                        }}
                        placeholder="AIzaSy... (발급받은 키를 붙여넣으세요)"
                        className="flex-1 min-w-0 w-full px-3 py-2 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveAndTestAiKey()}
                        disabled={isTestingKey}
                        className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-md transition shrink-0 whitespace-nowrap flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        {isTestingKey ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                            <span>검증중...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>연동 및 테스트</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Status Message */}
                    {keyTestStatus && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                          keyTestStatus.ok
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-rose-50 border-rose-300 text-rose-800'
                        }`}
                      >
                        {keyTestStatus.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{keyTestStatus.message}</span>
                      </div>
                    )}

                    {/* Free Tier Quota Gauge Bar */}
                    {geminiApiKey && (
                      <div className="p-3.5 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20 rounded-2xl border border-emerald-200/90 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                              <Gauge className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">무료 AI 사용량 현황</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Google Free Tier
                          </span>
                        </div>

                        {/* Progress Gauge */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                            <span>
                              오늘 잔여:{' '}
                              <strong className="text-emerald-700 font-bold">
                                {aiUsageStats.remainingCount.toLocaleString()}회
                              </strong>{' '}
                              / {aiUsageStats.dailyLimit.toLocaleString()}회
                            </span>
                            <span className="text-emerald-700 font-bold">
                              {aiUsageStats.remainingPercent}% 남음
                            </span>
                          </div>

                          <div className="w-full h-2.5 bg-slate-200/90 rounded-full overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                aiUsageStats.remainingPercent > 25
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                  : aiUsageStats.remainingPercent > 10
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                  : 'bg-gradient-to-r from-rose-500 to-red-500'
                              }`}
                              style={{ width: `${Math.max(4, aiUsageStats.remainingPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* Quota details & Link to Google AI Studio */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-slate-500 border-t border-slate-200/70">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 font-medium text-slate-600">
                              <Zap className="w-3 h-3 text-amber-500" />
                              <span>분당 한도: <strong>15회 (15 RPM)</strong></span>
                            </span>
                            <span className="text-slate-400">• 매일 00:00 리셋</span>
                          </div>
                          <a
                            href="https://aistudio.google.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:text-brand-800 font-bold underline flex items-center gap-0.5"
                          >
                            <span>Google AI Studio 대시보드</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Unlink Button */}
                    {geminiApiKey && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>현재 키가 등록되어 작동 중입니다.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setStoredGeminiKey('');
                            setGeminiApiKey('');
                            setGeminiKeyInput('');
                            setKeyTestStatus(null);
                            triggerToast('AI 키 해제됨', '기본 로컬 모드로 전환되었습니다.');
                          }}
                          className="text-rose-500 hover:underline font-semibold cursor-pointer"
                        >
                          연동 해제
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: 👑 Vercel 서버 API 모니터링 및 관리자 제어 센터 */}
              {settingsTab === 'admin' && isAdmin && (
                <div className="space-y-4 animate-fade-in">
                  {/* Admin Top Header Card */}
                  <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 text-white rounded-2xl p-4.5 shadow-lg border border-purple-500/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">👑</span>
                        <div>
                          <h4 className="font-black text-sm text-white flex items-center gap-1.5">
                            <span>관리자 전용 관제 & 시스템 제어 센터</span>
                            <span className="text-[10px] bg-purple-500/40 text-purple-200 border border-purple-400/40 px-2 py-0.5 rounded-full font-bold">
                              {currentUser?.email}
                            </span>
                          </h4>
                          <p className="text-[11px] text-purple-200/80">
                            Vercel 서버 API, 전역 공지사항, 단어 데이터베이스 및 AI 프롬프트를 총괄 제어합니다.
                          </p>
                        </div>
                      </div>

                      {/* Refresh & Live Ping Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fetchServerUsage()}
                          disabled={isLoadingServerUsage}
                          className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-white/15 cursor-pointer disabled:opacity-50"
                          title="서버 통계 새로고침"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${isLoadingServerUsage ? 'animate-spin' : ''}`} />
                          <span>새로고침</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePingServerKey()}
                          disabled={isPingTesting}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                        >
                          {isPingTesting ? (
                            <>
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                              <span>진단 중...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>⚡ 실시간 핑 진단</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Live Ping Test Result Toast inside card */}
                    {pingResult && (
                      <div
                        className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border animate-fade-in ${
                          pingResult.ok
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                            : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {pingResult.ok ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span>
                            {pingResult.ok
                              ? `정상 응답! Google API 지연 시간: ${pingResult.durationMs}ms | 응답 모델: ${pingResult.modelUsed || 'gemini-2.0-flash'}`
                              : `진단 실패: ${pingResult.error || '연결 오류'}`}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/60">
                          {new Date().toLocaleTimeString()}
                        </span>
                      </div>
                    )}

                    {/* Admin Sub Navigation Tabs */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 pt-1 border-t border-purple-500/30 text-xs">
                      <button
                        type="button"
                        onClick={() => setAdminSection('api')}
                        className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          adminSection === 'api'
                            ? 'bg-white text-purple-950 shadow-sm'
                            : 'text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>API 관제</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminSection('notice')}
                        className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          adminSection === 'notice'
                            ? 'bg-white text-purple-950 shadow-sm'
                            : 'text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>전역 공지</span>
                        {announcement?.active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminSection('db')}
                        className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          adminSection === 'db'
                            ? 'bg-white text-purple-950 shadow-sm'
                            : 'text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>단어 DB & 백업</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminSection('sandbox')}
                        className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          adminSection === 'sandbox'
                            ? 'bg-white text-purple-950 shadow-sm'
                            : 'text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>AI 샌드박스</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminSection('system')}
                        className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer col-span-2 sm:col-span-1 ${
                          adminSection === 'system'
                            ? 'bg-white text-purple-950 shadow-sm'
                            : 'text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>인프라 진단</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 1: API & AI 관제 */}
                  {adminSection === 'api' && (
                    <div className="space-y-4 animate-fade-in">
                      {/* 1. Vercel Environment API Key Status Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <Server className="w-4 h-4 text-indigo-600" />
                            <span>Vercel 서버 환경 변수 상태</span>
                          </div>
                          {serverUsageReport?.isConfigured ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                              <Check className="w-2.5 h-2.5" />
                              <span>연동됨 (Active)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-full border border-rose-300">
                              미설정 (GEMINI_API_KEY 필요)
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[11px] text-slate-500 font-medium">마스킹된 서버 API 키</div>
                            <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
                              {serverUsageReport?.maskedKey || (isServerGeminiReady ? 'AIzaSy••••••••••••••••••••' : '미등록')}
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[11px] text-slate-500 font-medium">현재 작동 중인 AI 모델</div>
                            <div className="font-mono font-bold text-indigo-700 mt-0.5">
                              {serverUsageReport?.lastActiveModel || 'gemini-2.0-flash'} (자동 폴백)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            보안: Vercel Serverless Function 백엔드에 안전하게 격리되어 사용자 기기나 브라우저 개발자 도구에 노출되지 않습니다.
                          </span>
                        </div>
                      </div>

                      {/* 2. Today's Server API Usage & Quota Gauge */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <Gauge className="w-4 h-4 text-emerald-600" />
                            <span>오늘 Vercel API 사용량 & 구글 무료 한도</span>
                          </div>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Google Free Tier (1,500 RPD)
                          </span>
                        </div>

                        {/* Stat Badges Grid */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[10.5px] text-slate-500 font-semibold">오늘 서버 호출</div>
                            <div className="text-base font-black text-slate-900 mt-0.5">
                              {(serverUsageReport?.serverEnvCallsToday ?? 0).toLocaleString()}
                              <span className="text-xs font-normal text-slate-500 ml-0.5">회</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[10.5px] text-emerald-700 font-semibold">오늘 남은 횟수</div>
                            <div className="text-base font-black text-emerald-600 mt-0.5">
                              {(serverUsageReport?.remainingCalls ?? 1500).toLocaleString()}
                              <span className="text-xs font-normal text-slate-500 ml-0.5">회</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[10.5px] text-slate-500 font-semibold">일일 소모율</div>
                            <div className="text-base font-black text-indigo-600 mt-0.5">
                              {serverUsageReport?.usagePercent ?? 0}
                              <span className="text-xs font-normal text-slate-500 ml-0.5">%</span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                (serverUsageReport?.usagePercent ?? 0) < 70
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                  : (serverUsageReport?.usagePercent ?? 0) < 90
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                  : 'bg-gradient-to-r from-rose-500 to-red-500'
                              }`}
                              style={{
                                width: `${Math.max(3, 100 - (serverUsageReport?.usagePercent ?? 0))}%`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                            <span>잔여 {100 - (serverUsageReport?.usagePercent ?? 0)}% 남음</span>
                            <span>매일 자정 (00:00 KST) 자동 리셋</span>
                          </div>
                        </div>

                        {/* RPM Limit info */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500 border-t border-slate-200/70">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>분당 한도: <strong>15회 (15 RPM)</strong> 초과 방지 슬라이딩 윈도우 보호 작동 중</span>
                          </div>
                          <a
                            href="https://aistudio.google.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:text-brand-800 font-bold underline flex items-center gap-0.5"
                          >
                            <span>Google AI Studio</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>

                      {/* Admin Quick Action Toolbar */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2.5 text-xs">
                        <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-purple-600" />
                          <span>관리자 즉시 제어 도구</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={handleResetServerCounter}
                            disabled={isAdminActionRunning}
                            className="p-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-left font-bold text-slate-800 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                          >
                            <div className="flex items-center gap-1.5 text-indigo-600 mb-0.5">
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>사용량 카운터 리셋</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-normal">
                              오늘의 서버 호출 수치를 0회로 초기화
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={handleClearRateLimits}
                            disabled={isAdminActionRunning}
                            className="p-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-left font-bold text-slate-800 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                          >
                            <div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
                              <Zap className="w-3.5 h-3.5" />
                              <span>IP 접속 제한 해제</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-normal">
                              429 초과로 차단된 IP 슬라이딩 윈도우 해제
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={handleClearUsageLogs}
                            disabled={isAdminActionRunning}
                            className="p-2.5 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 rounded-xl text-left font-bold text-slate-800 hover:text-rose-700 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                          >
                            <div className="flex items-center gap-1.5 text-rose-600 mb-0.5">
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>호출 기록 비우기</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-normal">
                              최근 서버 API 호출 타임라인 로그 삭제
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* 3. Breakdown by Feature */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2.5 text-xs">
                        <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-purple-600" />
                          <span>기능별 Vercel API 호출 통계</span>
                        </h5>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                            <div className="text-[10px] text-slate-500 font-medium">📸 책 사진 OCR</div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                              {((serverUsageReport?.byEndpoint?.visionOcr ?? 0) + (serverUsageReport?.byEndpoint?.matchSentence ?? 0)).toLocaleString()}회
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                            <div className="text-[10px] text-slate-500 font-medium">✍️ 문맥 문장 번역</div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                              {(serverUsageReport?.byEndpoint?.translate ?? 0).toLocaleString()}회
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                            <div className="text-[10px] text-slate-500 font-medium">📖 영한 사전 보완</div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                              {(serverUsageReport?.byEndpoint?.dictionary ?? 0).toLocaleString()}회
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                            <div className="text-[10px] text-slate-500 font-medium">⚡ 진단 및 기타</div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                              {(serverUsageReport?.byEndpoint?.other ?? 0).toLocaleString()}회
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Recent API Calls Timeline */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                            <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                            <span>최근 서버 API 호출 내역 (최근 15건)</span>
                          </h5>
                          <span className="text-[10px] text-slate-400">실시간 로그</span>
                        </div>

                        {(!serverUsageReport?.recentLogs || serverUsageReport.recentLogs.length === 0) ? (
                          <div className="p-4 bg-white rounded-xl border border-slate-200/70 text-center text-slate-400 text-xs">
                            오늘 아직 발생한 서버 API 호출 내역이 없습니다. (단어 사진 등록이나 번역 실행 시 기록됩니다)
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {serverUsageReport.recentLogs.slice(0, 15).map((log: any) => (
                              <div
                                key={log.id}
                                className="p-2 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 text-[11px]"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      log.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                  />
                                  <span className="font-bold text-slate-800 shrink-0">
                                    {log.endpoint === 'ocr-vision'
                                      ? '책 사진 OCR'
                                      : log.endpoint === 'match-sentence-vision'
                                      ? '문맥 사진 매칭'
                                      : log.endpoint === 'match-sentence-text'
                                      ? '문맥 텍스트 매칭'
                                      : log.endpoint === 'translate'
                                      ? '문장 자동 번역'
                                      : log.endpoint === 'dictionary'
                                      ? '사전/단어 분석'
                                      : log.endpoint === 'admin-ping'
                                      ? '관리자 핑 진단'
                                      : log.endpoint}
                                  </span>
                                  <span className="text-slate-400 text-[10px] shrink-0 font-mono">
                                    {log.model}
                                  </span>
                                  {log.error && (
                                    <span className="text-rose-600 text-[10px] truncate max-w-[120px]" title={log.error}>
                                      {log.error}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 font-mono text-[10.5px]">
                                  <span className="text-slate-500">{log.durationMs}ms</span>
                                  <span className="text-slate-400">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: 전역 공지사항 배너 관리 */}
                  {adminSection === 'notice' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3.5 animate-fade-in text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Megaphone className="w-4 h-4 text-purple-600" />
                          <span>전역 공지사항 배너 제어</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={noticeInputActive}
                            onChange={(e) => setNoticeInputActive(e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                          />
                          <span className={`text-xs font-bold ${noticeInputActive ? 'text-purple-700' : 'text-slate-400'}`}>
                            {noticeInputActive ? '배너 활성화 (ON)' : '배너 비활성화 (OFF)'}
                          </span>
                        </label>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        공지를 활성화하면 모든 사용자의 메인 화면 상단에 알림 배너가 실시간 노출됩니다.
                      </p>

                      {/* Notice Type Selector */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">배너 유형</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setNoticeInputType('info')}
                            className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                              noticeInputType === 'info'
                                ? 'bg-blue-50 border-blue-400 text-blue-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>💡 일반 안내</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoticeInputType('warning')}
                            className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                              noticeInputType === 'warning'
                                ? 'bg-amber-50 border-amber-400 text-amber-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>⚠️ 긴급 점검</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoticeInputType('update')}
                            className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                              noticeInputType === 'update'
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>🚀 기능 업데이트</span>
                          </button>
                        </div>
                      </div>

                      {/* Notice Message Input */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">공지 문구</label>
                        <textarea
                          value={noticeInputMsg}
                          onChange={(e) => setNoticeInputMsg(e.target.value)}
                          placeholder="사용자들에게 안내할 공지사항 문구를 입력하세요..."
                          rows={3}
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                        />
                      </div>

                      {/* Live Preview */}
                      <div className="space-y-1 pt-1">
                        <label className="block text-[11px] font-bold text-slate-500">배너 실시간 미리보기</label>
                        <div
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                            noticeInputType === 'warning'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : noticeInputType === 'update'
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                              : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}
                        >
                          <span className="text-sm shrink-0">
                            {noticeInputType === 'warning' ? '⚠️' : noticeInputType === 'update' ? '🚀' : '💡'}
                          </span>
                          <span className="truncate">{noticeInputMsg || '공지 문구가 표시됩니다.'}</span>
                        </div>
                      </div>

                      {/* Save Button */}
                      <button
                        type="button"
                        onClick={handleSaveAnnouncement}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>전역 공지사항 저장 및 실시간 적용</span>
                      </button>
                    </div>
                  )}

                  {/* SECTION 3: 단어 데이터베이스 & 프리셋 관리 */}
                  {adminSection === 'db' && (
                    <div className="space-y-3.5 animate-fade-in text-xs">
                      {/* Vocab Overview Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Database className="w-4 h-4 text-indigo-600" />
                            <span>현재 단어장 데이터베이스 현황</span>
                          </h5>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                            동기화 활성
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[10px] text-slate-500 font-medium">총 단어 수</div>
                            <div className="text-base font-black text-slate-900 mt-0.5">
                              {vocabulary.length.toLocaleString()}
                              <span className="text-xs font-normal text-slate-500 ml-0.5">개</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[10px] text-slate-500 font-medium">등록된 책/단어장</div>
                            <div className="text-base font-black text-indigo-600 mt-0.5">
                              {new Set(vocabulary.map((w) => w.bookTitle || '기본 단어장')).size}
                              <span className="text-xs font-normal text-slate-500 ml-0.5">권</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <div className="text-[10px] text-slate-500 font-medium">퀴즈 학습 단어</div>
                            <div className="text-base font-black text-emerald-600 mt-0.5">
                              {vocabulary.filter((w) => (w.correctCount || 0) > 0).length}
                              <span className="text-xs font-normal text-slate-500 ml-0.5">개</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Master Backup Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Download className="w-4 h-4 text-emerald-600" />
                            <span>전체 마스터 단어 데이터 JSON 백업</span>
                          </h5>
                          <span className="text-[10px] text-slate-400">데이터 완전 보관</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          현재 계정의 모든 단어 데이터(영어, 한국어 뜻, 품사, 원문 문맥 문장, AI 한글 번역)를 완전한 JSON 파일로 원클릭 백업 다운로드합니다.
                        </p>
                        <button
                          type="button"
                          onClick={handleExportAllVocabJson}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>전체 단어 JSON 백업 파일 다운로드</span>
                        </button>
                      </div>

                      {/* Force Preset Reset Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-rose-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-rose-900 flex items-center gap-1.5">
                            <RotateCcw className="w-4 h-4 text-rose-600" />
                            <span>기본 30개 단어 프리셋 강제 재동기화 / 클린 복구</span>
                          </h5>
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                            관리자 전용
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          3개 기본 책(원서 리딩 명작선 10단어, 필수 비즈니스 10단어, 수능·토익 핵심 10단어)의 30개 기본 프리셋으로 단어장을 완전 초기화합니다.
                        </p>
                        <button
                          type="button"
                          onClick={handleAdminForceResetPresets}
                          disabled={isAdminActionRunning}
                          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className={`w-4 h-4 ${isAdminActionRunning ? 'animate-spin' : ''}`} />
                          <span>기본 30개 프리셋으로 강제 클린 리셋 실행</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SECTION 4: AI 프롬프트 샌드박스 */}
                  {adminSection === 'sandbox' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3 animate-fade-in text-xs">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Terminal className="w-4 h-4 text-purple-600" />
                          <span>Google Gemini AI 실시간 프롬프트 샌드박스</span>
                        </h5>
                        <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                          Vercel GEMINI_API_KEY 사용
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        개발자 도구나 터미널 없이 브라우저에서 서버 Gemini API를 직접 호출해 응답 속도와 JSON 결과를 실시간 테스트합니다.
                      </p>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">테스트 프롬프트</label>
                        <textarea
                          value={adminSandboxPrompt}
                          onChange={(e) => setAdminSandboxPrompt(e.target.value)}
                          rows={3}
                          placeholder="테스트할 프롬프트를 입력하세요..."
                          className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleRunAdminSandbox}
                        disabled={isAdminSandboxRunning || !adminSandboxPrompt.trim()}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {isAdminSandboxRunning ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin" />
                            <span>AI 분석 실행 중...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span>AI 프롬프트 즉시 실행</span>
                          </>
                        )}
                      </button>

                      {/* Sandbox Result Viewer */}
                      {adminSandboxResult && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-200">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={adminSandboxResult.ok ? 'text-emerald-700' : 'text-rose-700'}>
                              {adminSandboxResult.ok
                                ? `응답 성공! 지연 시간: ${adminSandboxResult.latencyMs}ms | 모델: ${adminSandboxResult.modelUsed}`
                                : `실행 실패: ${adminSandboxResult.error}`}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                          <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap">
                            {adminSandboxResult.text || JSON.stringify(adminSandboxResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 5: 인프라 & 시스템 진단 */}
                  {adminSection === 'system' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3 animate-fade-in text-xs">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Server className="w-4 h-4 text-indigo-600" />
                          <span>Vercel 서버 & 인프라 실시간 진단</span>
                        </h5>
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          Node.js Runtime
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                          <div className="text-[11px] text-slate-500 font-medium">배포 환경 & Region</div>
                          <div className="font-mono font-bold text-slate-900">
                            {adminSystemInfo?.vercelEnv || 'production'} ({adminSystemInfo?.vercelRegion || 'icn1/seoul'})
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                          <div className="text-[11px] text-slate-500 font-medium">Node.js 버전 & 플랫폼</div>
                          <div className="font-mono font-bold text-slate-900">
                            {adminSystemInfo?.nodeVersion || 'v20.x'} ({adminSystemInfo?.platform || 'darwin'})
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                          <div className="text-[11px] text-slate-500 font-medium">서버 프로세스 메모리 (RSS / Heap)</div>
                          <div className="font-mono font-bold text-indigo-700">
                            RSS: {adminSystemInfo?.memory?.rssMb ?? 64}MB / Heap: {adminSystemInfo?.memory?.heapUsedMb ?? 32}MB
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                          <div className="text-[11px] text-slate-500 font-medium">Supabase 클라우드 DB</div>
                          <div className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>연결 상태 정상 (PostgreSQL)</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1 text-[11px] text-indigo-900 leading-relaxed">
                        <div className="font-bold flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-indigo-600" />
                          <span>환경 변수 무결성 검사</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[10.5px]">
                          <li>
                            <code>GEMINI_API_KEY</code>:{' '}
                            <strong className="text-emerald-700">
                              {serverUsageReport?.isConfigured ? '정상 등록됨 (24자 이상)' : '미설정'}
                            </strong>
                          </li>
                          <li>
                            <code>NEXT_PUBLIC_SUPABASE_URL</code>:{' '}
                            <strong className="text-emerald-700">
                              {adminSystemInfo?.hasSupabaseUrl !== false ? '정상 등록됨' : '미설정'}
                            </strong>
                          </li>
                          <li>
                            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>:{' '}
                            <strong className="text-emerald-700">
                              {adminSystemInfo?.hasSupabaseKey !== false ? '정상 등록됨' : '미설정'}
                            </strong>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: 퀴즈 & 환경 설정 */}
              {settingsTab === 'preferences' && (
                <div className="space-y-3.5 text-xs text-slate-600 animate-fade-in">
                  {/* 1. 5지선다 퀴즈 문제 수 설정 */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-indigo-600" />
                        <span>5지선다 퀴즈 기본 문제 수</span>
                      </label>
                      <span className="text-[11px] font-black text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full border border-indigo-200">
                        {quizQuestionCount === 0 ? '단어장 전체' : `${quizQuestionCount}문제`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      1회 퀴즈 시 출제할 기본 문제 수를 설정합니다. (단어장에 등록된 단어가 더 적으면 단어장 전체가 출제됩니다)
                    </p>
                    <select
                      value={quizQuestionCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setQuizQuestionCount(val);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('context_vocab_quiz_question_count', val.toString());
                        }
                        triggerToast('퀴즈 설정 저장됨', `기본 문제 수가 ${val === 0 ? '단어장 전체' : val + '문제'}로 설정되었습니다.`);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value={10}>10문제 (가벼운 복습)</option>
                      <option value={15}>15문제</option>
                      <option value={20}>20문제 (추천)</option>
                      <option value={25}>25문제</option>
                      <option value={30}>30문제 (집중 복습)</option>
                      <option value={0}>전체 (단어장 수록 단어 모두 출제)</option>
                    </select>
                  </div>

                  {/* TTS Voice Select & Speed Slider */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1.5">발음 음성(TTS) 악센트</label>
                      <select
                        value={ttsVoice}
                        onChange={(e) => {
                          setTtsVoice(e.target.value);
                          localStorage.setItem('context_vocab_tts_voice', e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 shadow-2xs"
                      >
                        <option value="en-US">영어 (미국식 - US English)</option>
                        <option value="en-GB">영어 (영국식 - GB English)</option>
                      </select>
                    </div>

                    {/* TTS Speed Slider */}
                    <div className="pt-2.5 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>읽기 속도 조절</span>
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono">
                            {ttsRate.toFixed(2)}x
                            {ttsRate === 1.25 ? '' : ttsRate === 1.0 ? ' (보통)' : ttsRate < 1.0 ? ' (느리게)' : ' (빠르게)'}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => speakSentenceTTS('What is essential is invisible to the eye.', ttsVoice, ttsRate)}
                          className="text-[11px] bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition shadow-2xs cursor-pointer active:scale-95"
                          title="현재 설정된 악센트와 속도로 샘플 문장을 들어봅니다"
                        >
                          <Volume2 className="w-3 h-3 text-indigo-600" />
                          <span>테스트 듣기</span>
                        </button>
                      </div>

                      {/* Slider Input */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-slate-400 font-mono">0.6x</span>
                        <input
                          type="range"
                          min="0.6"
                          max="1.6"
                          step="0.05"
                          value={ttsRate}
                          onChange={(e) => handleTtsRateChange(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <span className="text-[11px] font-bold text-slate-400 font-mono">1.6x</span>
                      </div>

                      {/* Preset Chips */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {[
                          { label: '0.8x', rate: 0.8 },
                          { label: '1.0x', rate: 1.0 },
                          { label: '1.25x', rate: 1.25 },
                          { label: '1.4x', rate: 1.4 },
                        ].map((preset) => (
                          <button
                            key={preset.rate}
                            type="button"
                            onClick={() => handleTtsRateChange(preset.rate)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                              Math.abs(ttsRate - preset.rate) < 0.02
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Data Reset Options */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="font-bold text-slate-800 mb-1">단어 데이터 관리</div>
                    <p className="text-[11px] text-slate-500 mb-2.5">
                      단어장을 기본 상태로 되돌리거나 모든 데이터를 삭제할 수 있습니다.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('기본 샘플 단어(총 30단어, 3개 단어장)로 초기화할까요?')) return;
                          const samples = await resetWithSamples(currentUser?.id);
                          if (samples && samples.length > 0) {
                            setVocabulary(samples);
                            setSelectedBookFilters(['all']);
                            setInputBookTitle('원서 첫걸음: 어린 왕자');
                          }
                          await loadData(currentUser);
                          setIsSettingsOpen(false);
                          triggerToast('초기화 완료 🎉', '기본 3개 단어장(총 30단어)이 복원되었습니다.');
                        }}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
                      >
                        기본 샘플로 초기화 (30단어)
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('단어장의 모든 단어를 삭제할까요? 되돌릴 수 없습니다.')) return;
                          await clearAllVocab(currentUser?.id);
                          setVocabulary([]);
                          setSelectedBookFilters(['all']);
                          await loadData(currentUser);
                          setIsSettingsOpen(false);
                          triggerToast('전체 삭제 완료 🗑️', '단어장의 모든 단어가 비워졌습니다.');
                        }}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
                      >
                        전체 비우기
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email / Password Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    {authMode === 'login'
                      ? '로그인'
                      : authMode === 'signup'
                      ? '회원가입'
                      : authMode === 'forgot'
                      ? '비밀번호 재설정'
                      : '새 비밀번호 등록'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    {authMode === 'forgot'
                      ? '가입하신 이메일로 재설정 링크를 보내드립니다'
                      : authMode === 'reset'
                      ? '새로 사용할 안전한 비밀번호를 입력해 주세요'
                      : '이메일 계정으로 어디서나 내 단어장 동기화'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthError(null);
                  setAuthSuccessMsg(null);
                  if (authMode === 'forgot' || authMode === 'reset') {
                    setAuthMode('login');
                  }
                }}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Mode Switch Tabs or Back Buttons */}
            {authMode === 'login' || authMode === 'signup' ? (
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                    setAuthSuccessMsg(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                    setAuthSuccessMsg(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  회원가입
                </button>
              </div>
            ) : authMode === 'forgot' ? (
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                    setAuthSuccessMsg(null);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
                >
                  ← 로그인 화면으로 돌아가기
                </button>
              </div>
            ) : (
              <div className="p-2.5 bg-indigo-50/80 border border-indigo-100 rounded-xl text-center">
                <span className="text-xs font-bold text-indigo-700">🔐 계정 복구 모드 활성화됨</span>
              </div>
            )}

            {/* Error / Success Messages */}
            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{authError}</span>
              </div>
            )}
            {authSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="leading-relaxed">{authSuccessMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5">
              {/* Email field (not needed in reset password mode) */}
              {authMode !== 'reset' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">이메일 주소</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>
                </div>
              )}

              {/* Password field (not needed in forgot password mode) */}
              {authMode !== 'forgot' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {authMode === 'reset' ? '새 비밀번호' : '비밀번호'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={authMode === 'login' ? '비밀번호 입력' : '비밀번호 (6자 이상)'}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>
                </div>
              )}

              {/* Forgot password link (only in login mode) */}
              {authMode === 'login' && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setAuthError(null);
                      setAuthSuccessMsg(null);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition cursor-pointer"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
              )}

              {/* Password confirmation (in signup or reset mode) */}
              {(authMode === 'signup' || authMode === 'reset') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {authMode === 'reset' ? '새 비밀번호 확인' : '비밀번호 확인'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={authPasswordConfirm}
                      onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                      placeholder="비밀번호 다시 입력"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAuthSubmitting ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>처리 중...</span>
                  </>
                ) : (
                  <span>
                    {authMode === 'login'
                      ? '로그인'
                      : authMode === 'signup'
                      ? '회원가입 완료'
                      : authMode === 'forgot'
                      ? '재설정 링크 보내기'
                      : '새 비밀번호 적용 완료'}
                  </span>
                )}
              </button>
            </form>

            {/* Divider & Google OAuth Option (only in login/signup mode) */}
            {(authMode === 'login' || authMode === 'signup') && (
              <>
                <div className="relative my-2 flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] text-slate-400 font-medium absolute">또는</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAuthModalOpen(false);
                    handleGoogleLoginClick();
                  }}
                  disabled={isLoggingIn}
                  className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <GoogleIcon className="w-4 h-4 shrink-0" />
                  <span>Google 계정으로 계속하기</span>
                </button>
              </>
            )}

            <p className="text-[11px] text-center text-slate-400">
              로그인 없이도 단어는 이 브라우저에 안전하게 보관됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Dedicated Supabase & Google Login Modal */}
      {isSupabaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    Supabase & Google 로그인 연동
                  </h3>
                  <p className="text-[11px] text-emerald-600 font-semibold">
                    개인별 단어장 클라우드 자동 보관 및 Google 계정 로그인
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSupabaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Status Banner */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isSupabaseReady
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isSupabaseReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <div>
                  <p className="font-bold text-xs">
                    {isSupabaseReady
                      ? (currentUser
                          ? `연결 완료: ${currentUser.email} 님 계정`
                          : 'Supabase 프로젝트 연동됨 (로그인 대기)')
                      : 'Supabase 미연결 (로컬 스토리지 모드)'}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {isSupabaseReady
                      ? 'RLS 보안 정책을 통해 다른 사용자가 내 단어를 볼 수 없습니다.'
                      : '아래에 Supabase 정보를 입력하면 Google 로그인이 활성화됩니다.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Supabase URL & Anon Key Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. Supabase Project URL
                </label>
                <input
                  type="text"
                  value={inputSupabaseUrl}
                  onChange={(e) => setInputSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  2. Supabase Anon (Public) Key
                </label>
                <input
                  type="password"
                  value={inputSupabaseAnonKey}
                  onChange={(e) => setInputSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveSupabaseConfig}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>연동 정보 저장</span>
                </button>
                {isSupabaseReady && (
                  <button
                    type="button"
                    onClick={handleDisconnectSupabase}
                    className="px-4 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
                  >
                    연동 해제
                  </button>
                )}
              </div>
            </div>

            {/* Quick 1-Click SQL Copy Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>3. Supabase SQL 테이블 생성</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined') {
                      navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                      setIsCopiedSql(true);
                      triggerToast('SQL 복사 완료! 📋', 'Supabase SQL Editor에 붙여넣고 [RUN]을 누르세요.');
                      setTimeout(() => setIsCopiedSql(false), 2500);
                    }
                  }}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1 transition cursor-pointer"
                >
                  {isCopiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedSql ? '복사됨!' : 'SQL 복사'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Supabase Dashboard의 <strong>SQL Editor</strong>에서 위 복사한 SQL을 붙여넣고 실행하면 개인별 데이터 격리(RLS) 및 단어장 테이블이 자동 구축됩니다.
              </p>
            </div>

            {/* Google OAuth Quick Guide */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-2 text-xs text-slate-700">
              <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                <GoogleIcon className="w-3.5 h-3.5" />
                <span>Google 로그인 활성화 가이드 (1분)</span>
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600 leading-relaxed">
                <li>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 underline font-bold"
                  >
                    Supabase Dashboard
                  </a>
                  {' > '}Authentication{' > '}Providers{' > '}<strong>Google</strong>을 활성화합니다.
                </li>
                <li>
                  Google Cloud Console에서 OAuth 클라이언트 ID를 만들고 Callback URL에 다음을 등록합니다:
                  <div className="mt-1 bg-white p-1.5 rounded border border-indigo-200 font-mono text-[10px] text-indigo-900 select-all">
                    {inputSupabaseUrl
                      ? `${inputSupabaseUrl.replace(/\/$/, '')}/auth/v1/callback`
                      : 'https://<당신의-프로젝트-ID>.supabase.co/auth/v1/callback'}
                  </div>
                </li>
              </ol>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 단어장 삭제 모달 */}
      {isDeleteBookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    단어장 삭제
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5 truncate max-w-[280px] sm:max-w-xs">
                    &apos;{bookToDelete}&apos; 단어장을 정리합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteBookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Word count check */}
            {(() => {
              const wordsCount = vocabulary.filter(
                (v) => (v.bookTitle || '기본 단어장') === bookToDelete
              ).length;

              if (wordsCount === 0) {
                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">
                        &apos;{bookToDelete}&apos; 단어장에 등록된 단어가 없습니다.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        단어장을 목록에서 삭제하시겠습니까?
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsDeleteBookModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingBook}
                        onClick={handleConfirmDeleteBook}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeletingBook ? '삭제 중...' : '단어장 삭제'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              const targetCandidates = availableBookTitles.filter(
                (t) => t !== bookToDelete
              );

              return (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      현재 <strong className="font-black text-amber-950">&apos;{bookToDelete}&apos;</strong> 단어장에{' '}
                      <strong className="font-black text-amber-950 underline">{wordsCount}단어</strong>가 저장되어 있습니다.
                      <div className="text-[11px] text-amber-700 mt-0.5">
                        단어들을 다른 단어장으로 안전하게 옮길지, 아니면 단어장과 함께 모두 삭제할지 선택해 주세요.
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-2.5">
                    {/* Option 1: Move Words (Safe) */}
                    <div
                      onClick={() => setDeleteBookAction('move')}
                      className={`block p-4 rounded-2xl border-2 transition cursor-pointer ${
                        deleteBookAction === 'move'
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            deleteBookAction === 'move'
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-slate-300'
                          }`}
                        >
                          {deleteBookAction === 'move' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              다른 단어장으로 단어 옮기기
                            </span>
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                              권장 · 안전 보존
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                            기존 단어({wordsCount}개)의 뜻과 예문, 퀴즈 기록을 유지한 채 다른 단어장으로 모두 옮긴 후 현재 단어장만 삭제합니다.
                          </p>

                          {deleteBookAction === 'move' && (
                            <div className="mt-3 pt-3 border-t border-indigo-100/80 space-y-2" onClick={(e) => e.stopPropagation()}>
                              <label className="block text-[11px] font-bold text-slate-700">
                                이동할 대상 단어장 선택
                              </label>
                              <div className="relative">
                                <select
                                  value={isTargetCustom ? '__custom__' : targetMoveBook}
                                  onChange={(e) => {
                                    if (e.target.value === '__custom__') {
                                      setIsTargetCustom(true);
                                    } else {
                                      setIsTargetCustom(false);
                                      setTargetMoveBook(e.target.value);
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
                                >
                                  {targetCandidates.map((title) => {
                                    const c = vocabulary.filter(
                                      (v) => (v.bookTitle || '기본 단어장') === title
                                    ).length;
                                    return (
                                      <option key={title} value={title}>
                                        {title} ({c}단어 보관 중)
                                      </option>
                                    );
                                  })}
                                  <option value="__custom__">+ 새 단어장 만들어 이동...</option>
                                </select>
                              </div>

                              {isTargetCustom && (
                                <input
                                  type="text"
                                  value={targetCustomBook}
                                  onChange={(e) => setTargetCustomBook(e.target.value)}
                                  placeholder="새 단어장 이름 입력 (예: 기본 단어장)"
                                  className="w-full px-3 py-2 text-xs bg-white text-slate-900 border-2 border-indigo-500 rounded-xl focus:outline-none font-bold"
                                  autoFocus
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Option 2: Delete Words Together */}
                    <div
                      onClick={() => setDeleteBookAction('delete_all')}
                      className={`block p-4 rounded-2xl border-2 transition cursor-pointer ${
                        deleteBookAction === 'delete_all'
                          ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            deleteBookAction === 'delete_all'
                              ? 'border-rose-600 bg-rose-600'
                              : 'border-slate-300'
                          }`}
                        >
                          {deleteBookAction === 'delete_all' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-rose-700">
                              단어도 함께 모두 삭제
                            </span>
                            <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                              주의 · 복구 불가
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                            단어장과 함께 수록된 {wordsCount}개의 단어도 영구히 삭제됩니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsDeleteBookModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      취소
                    </button>
                    {deleteBookAction === 'move' ? (
                      <button
                        type="button"
                        disabled={isDeletingBook}
                        onClick={handleConfirmDeleteBook}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                        <span>{isDeletingBook ? '이동 중...' : `단어 ${wordsCount}개 이동 및 삭제`}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isDeletingBook}
                        onClick={handleConfirmDeleteBook}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeletingBook ? '삭제 중...' : `단어 ${wordsCount}개 포함 모두 삭제`}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Floating Animated Toast Notification (Bottom placed to never cover top tabs or header) */}
      {toast && (
        <div className="fixed bottom-6 sm:bottom-8 inset-x-0 z-[9999] flex justify-center pointer-events-none px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="pointer-events-auto bg-slate-900/95 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center gap-3 max-w-sm sm:max-w-md w-full animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-rose-400 flex items-center justify-center text-base shadow-md shrink-0">
              🎉
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-white leading-tight">{toast.title}</h4>
              {toast.subtitle && (
                <p className="text-[10.5px] sm:text-[11px] text-slate-300 truncate mt-0.5">{toast.subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white text-xs p-1 rounded-lg cursor-pointer transition hover:bg-slate-800"
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
