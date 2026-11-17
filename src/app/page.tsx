'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VocabItem, DictSearchResult } from '@/types/vocab';
import {
  fetchVocabulary,
  addVocabularyItem,
  saveOrMergeVocabularyItem,
  deleteVocabularyItem,
  updateVocabularyContext,
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
  DISTRACTOR_POOL_KOREAN,
} from '@/lib/dictionary';
import { getLiveDictCandidates, fetchLiveDictSuggestions, SuggestionItem } from '@/lib/autocomplete';
import {
  extractTextFromPageImage,
  findSentenceWithWord,
  findSentenceWithWordSmart,
  findAllSentencesWithWordSmart,
  extractLemmaCandidate,
} from '@/lib/ocr';
import {
  extractTextWithAI,
  findSentenceWithAI,
  getStoredGeminiKey,
  setStoredGeminiKey,
} from '@/lib/gemini';
import { fireConfetti } from '@/lib/confetti';
import {
  checkIsSupabaseConfigured,
  getStoredSupabaseConfig,
  setStoredSupabaseConfig,
  signInWithGoogle,
  signOutUser,
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
} from 'lucide-react';

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

interface WordEntryItem {
  id: string;
  word: string;
  context: string;
  sourceMemo: string;
  dictResult: DictSearchResult | null;
  selectedMeaning: string;
  selectedPos: string;
  customMeaning: string;
  isSearchingDict: boolean;
  liveCandidates: SuggestionItem[];
  candidateSentences: string[];
  ocrDetectedNotice: string | null;
}

function createWordEntryItem(init?: Partial<WordEntryItem>): WordEntryItem {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    word: '',
    context: '',
    sourceMemo: '',
    dictResult: null,
    selectedMeaning: '',
    selectedPos: '',
    customMeaning: '',
    isSearchingDict: false,
    liveCandidates: [],
    candidateSentences: [],
    ocrDetectedNotice: null,
    ...init,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'add' | 'list' | 'quiz'>('add');
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Multi-Word Form State: 한 번에 여러 단어를 추가/등록할 수 있는 단어 등록칸 목록
  const [wordEntries, setWordEntries] = useState<WordEntryItem[]>([createWordEntryItem()]);
  const [inputBookTitle, setInputBookTitle] = useState('햄릿 (Hamlet)');
  const [isCustomBook, setIsCustomBook] = useState(false);
  const [customBookInput, setCustomBookInput] = useState('');
  // 단어장별 최근 사용 시각(타임스탬프) 기록
  const [bookUsageMap, setBookUsageMap] = useState<Record<string, number>>({});

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

  // OCR & Web Source State (현재 로드된 페이지/웹문서 텍스트 & 캐시)
  const [pageOcrText, setPageOcrText] = useState<string>('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrDetectedNotice, setOcrDetectedNotice] = useState<string | null>(null);
  const [detectedCandidateSentences, setDetectedCandidateSentences] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAppendModeRef = useRef<boolean>(false);
  const [completingSentenceId, setCompletingSentenceId] = useState<string | null>(null);

  // Background Non-blocking Processing State (백그라운드 분석 및 저장 대기)
  const [isSourceProcessing, setIsSourceProcessing] = useState(false);
  const [sourceProcessTaskName, setSourceProcessTaskName] = useState<string>('');
  const [isSavingAwaitingSource, setIsSavingAwaitingSource] = useState(false);
  const sourceTaskPromiseRef = useRef<Promise<string | null> | null>(null);
  const wordDebounceTimersRef = useRef<{ [entryId: string]: any }>({});

  // Web URL Scraper & Article Paste State (웹페이지 URL 또는 로그인/유료 기사 본문 붙여넣기)
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

  // Word Selection from Loaded Text State (원문에서 단어 직접 클릭 선택)
  const [isWordSelectModalOpen, setIsWordSelectModalOpen] = useState(false);
  const [selectedWordsFromText, setSelectedWordsFromText] = useState<string[]>([]);

  // Filter & Grouping State
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');

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
  // 퀴즈 복습 시 번갈아 가며 출제되는 현재 문맥 문장
  const [quizSentenceIdx, setQuizSentenceIdx] = useState<number>(0);
  const [quizActiveSentence, setQuizActiveSentence] = useState<string>('');

  // User Authentication & Supabase Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState('');
  const [inputSupabaseAnonKey, setInputSupabaseAnonKey] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCopiedSql, setIsCopiedSql] = useState(false);
  const [isSyncingWords, setIsSyncingWords] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [ttsVoice, setTtsVoice] = useState('en-US');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');

  // Floating Toast State
  const [toast, setToast] = useState<{ show: boolean; title: string; subtitle?: string } | null>(null);

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
        setKeyTestStatus({ ok: true, message: 'Google Gemini AI 연동 성공! 🤖 모든 AI 비전 및 문맥 분석 기능이 활성화되었습니다.' });
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

  // Load Data
  async function loadData(targetUser?: User | null) {
    const userToUse = targetUser !== undefined ? targetUser : currentUser;
    const list = await fetchVocabulary(userToUse);
    setVocabulary(list);
    setIsLoaded(true);
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
        if (lastBook) {
          setInputBookTitle(lastBook);
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

    const client = getSupabaseClient();
    if (client) {
      client.auth.getUser().then(({ data: { user } }) => {
        setCurrentUser(user ?? null);
        loadData(user ?? null);
      });

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user ?? null;
        setCurrentUser(user);

        if (event === 'SIGNED_IN' && user) {
          triggerToast(
            'Google 로그인 완료! 🎉',
            `${user.user_metadata?.full_name || user.email}님의 개인 클라우드 단어장이 연결되었습니다.`
          );
          await loadData(user);

          // URL 해시(#access_token) 또는 쿼리(?code=) 정돈
          if (typeof window !== 'undefined' && (window.location.hash || window.location.search.includes('code='))) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (event === 'SIGNED_OUT') {
          triggerToast('로그아웃되었습니다', '로컬 단어장 모드로 전환되었습니다.');
          await loadData(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      loadData(null);
    }
  }, []);

  // Settings on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('context_vocab_tts_voice');
      if (savedVoice) setTtsVoice(savedVoice);

      const lastBook = localStorage.getItem('context_vocab_last_book_title');
      if (lastBook) setInputBookTitle(lastBook);

      const savedPageOcr = localStorage.getItem('context_vocab_cached_page_ocr');
      if (savedPageOcr) setPageOcrText(savedPageOcr);

      const savedGeminiKey = getStoredGeminiKey();
      if (savedGeminiKey) {
        setGeminiApiKey(savedGeminiKey);
        setGeminiKeyInput(savedGeminiKey);
      }
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

  // Sign Out Handler
  async function handleSignOut() {
    setIsUserMenuOpen(false);
    await signOutUser();
    setCurrentUser(null);
    await loadData(null);
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
    processFn: () => Promise<{ text: string; title?: string; sourceUrl?: string; sentenceCount?: number; markedWords?: string[] }>
  ) {
    setIsSourceProcessing(true);
    setSourceProcessTaskName(taskName);

    const taskPromise = (async () => {
      try {
        const result = await processFn();
        setPageOcrText(result.text);
        setLoadedSourceType(sourceType);
        if (result.title) {
          setLoadedWebTitle(result.title);
          setInputBookTitle(result.title);
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
            findSentenceWithAI(result.text, w, geminiApiKey, entry.dictResult?.meanings).then((matchRes) => {
              if (matchRes.found && matchRes.sentence) {
                const sentences = matchRes.allMatches.map((m) => m.sentence);
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
                  candidateSentences: sentences,
                  selectedMeaning: bestDef || entry.selectedMeaning,
                  selectedPos: bestPos || entry.selectedPos,
                  ocrDetectedNotice:
                    sentences.length > 1
                      ? `✨ 본문 분석 완료! '${w}'가 쓰인 문장(${sentences.length}개)과 최적 뜻이 자동 연결되었습니다.`
                      : `✨ 본문 분석 완료! 원문 속 실제 문장이 자동으로 연결되었습니다.`,
                });
              }
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

  // 잘린 문장 AI 자동 완성 핸들러
  async function handleCompleteSentence(entryId: string, sentence: string, word: string) {
    if (!sentence || !sentence.trim()) return;
    setCompletingSentenceId(entryId);
    try {
      const res = await fetch('/api/ai/complete-sentence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(geminiApiKey ? { 'x-gemini-key': geminiApiKey } : {}),
        },
        body: JSON.stringify({ sentence, word }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.completedSentence) {
          updateWordEntry(entryId, {
            context: data.completedSentence,
            ocrDetectedNotice: '✨ AI가 잘린 문장을 자연스럽게 완성/보정했습니다.',
          });
          triggerToast('문장 완성 완료! ✨', '페이지 경계로 잘려 있던 문맥을 자연스럽게 보정했습니다.');
        }
      }
    } catch (err) {
      console.warn('Sentence completion error:', err);
    } finally {
      setCompletingSentenceId(null);
    }
  }

  // OCR 페이지 사진 촬영 / 업로드 핸들러 (백그라운드 비동기 처리 - 블로킹 없음 & 이어붙이기 지원)
  async function handlePagePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    const isAppend = isAppendModeRef.current;
    isAppendModeRef.current = false; // Reset

    setIsOcrProcessing(true);
    setOcrProgress(30);

    triggerToast(
      isAppend ? '다음 페이지 분석 시작! 📄' : '사진 분석 시작! 📸',
      isAppend
        ? '이전 페이지 문장 끝에 이어붙여 잘린 문맥을 하나로 연결합니다.'
        : '표/그래프를 제외한 본문 글자와 밑줄/동그라미 친 단어를 감지합니다.'
    );

    startBackgroundSourceAnalysis(
      isAppend ? '다음 페이지 이어붙이기' : '책 사진 분석',
      'camera',
      async () => {
        setOcrProgress(60);
        const { text: extractedText, markedWords } = await extractTextWithAI(file, geminiApiKey);
        setOcrProgress(100);

        // 이어붙이기 모드인 경우 기존 텍스트와 자연스럽게 연결
        const combinedText = isAppend && pageOcrText
          ? `${pageOcrText.trim()}\n\n${extractedText.trim()}`
          : extractedText;

        return { text: combinedText, markedWords };
      }
    );
  }

  // Handle Web Page URL Scraping (백그라운드 비동기 처리 - 블로킹 없음)
  async function handleScrapeUrl() {
    const targetUrl = inputWebUrl.trim();
    if (!targetUrl) {
      setUrlScrapeError('웹페이지 주소(URL)를 입력해 주세요.');
      return;
    }

    setUrlScrapeError(null);
    setIsUrlModalOpen(false);
    setInputWebUrl('');

    triggerToast('웹페이지 분석 시작! 🌐', '백그라운드에서 기사를 읽어오는 동안 단어를 먼저 입력하고 뜻을 고르세요.');

    startBackgroundSourceAnalysis('웹페이지 URL 분석', 'web', async () => {
      setIsUrlScraping(true);
      const res = await fetch('/api/scrape-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(geminiApiKey ? { 'x-gemini-key': geminiApiKey } : {}),
        },
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
  async function handleApplyPastedText() {
    const raw = inputPastedText.trim();
    if (!raw) {
      alert('붙여넣을 기사 본문 텍스트를 입력해 주세요!');
      return;
    }

    setIsCleaningPastedText(true);
    try {
      let cleaned = raw;
      let title = inputPastedTitle.trim();
      let removedAdCount = 0;

      if (autoRemoveAds) {
        try {
          const res = await fetch('/api/ai/clean-text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(geminiApiKey ? { 'x-gemini-key': geminiApiKey } : {}),
            },
            body: JSON.stringify({ rawText: raw }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.cleanedText) {
              cleaned = data.cleanedText;
              removedAdCount = data.removedCount || 0;
              if (!title && data.title) title = data.title;
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

  // Multi-Word Form Helpers
  function handleAddWordEntry() {
    setWordEntries((prev) => [...prev, createWordEntryItem()]);
    triggerToast('단어 등록칸 추가됨 ➕', '새 단어와 뜻을 입력하세요.');
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

      const initialDef = res.meanings.length > 0 ? res.meanings[0].def : '';
      const initialPos = res.meanings.length > 0 ? res.meanings[0].pos : '';

      // ⚡️ 즉시 사전 결과 화면에 노출 & 로딩 스피너 즉시 해제! (체감 대기시간 0초대 달성)
      updateWordEntry(entryId, {
        word: lemmaCandidate,
        dictResult: res,
        selectedMeaning: initialDef,
        selectedPos: initialPos,
        isSearchingDict: false, // 💡 사전 로딩 완료! 즉시 뜻 목록 선택 가능
        context: entry?.context || defaultExample,
        candidateSentences: [],
        ocrDetectedNotice: isSourceProcessing
          ? '⏳ 원문 사진 분석 진행 중입니다... 완료되면 사진 속 실제 문장으로 자동 연결됩니다.'
          : pageOcrText
          ? '🤖 문맥 속 문장 및 최적 뜻 분석 중...'
          : null,
      });

      // 3. 만약 현재 촬영/불러온 본문 텍스트가 있다면 비동기(백그라운드)로 문맥 탐색 & AI 최적 뜻 매칭
      if (pageOcrText) {
        try {
          // 본문 속 검색: 원래 단어(wordToSearch)와 원형(lemmaCandidate) 모두 전달
          const matchRes = await findSentenceWithAI(pageOcrText, wordToSearch, geminiApiKey, res.meanings);
          if (matchRes.found && matchRes.sentence) {
            const sentences = matchRes.allMatches.map((m) => m.sentence);

            // AI가 확정한 원형(Lemma)이 있으면 최종 표제어로 확정
            const finalLemma = (matchRes.lemma || lemmaCandidate).trim().toLowerCase();

            // AI가 문맥을 분석하여 선택해준 최적의 뜻 인덱스 적용
            let bestIdx = 0;
            if (
              typeof matchRes.bestMeaningIndex === 'number' &&
              matchRes.bestMeaningIndex >= 0 &&
              matchRes.bestMeaningIndex < res.meanings.length
            ) {
              bestIdx = matchRes.bestMeaningIndex;
            }

            const selectedDef =
              res.meanings[bestIdx]?.def ||
              matchRes.bestMeaningDef ||
              initialDef;
            const selectedPos =
              res.meanings[bestIdx]?.pos ||
              matchRes.bestPos ||
              initialPos;

            const isFormChanged = wordToSearch.toLowerCase() !== finalLemma;
            const formChangeMsg = isFormChanged
              ? `(원문 '${wordToSearch}' ➔ 표제어 '${finalLemma}') `
              : '';

            const noticeText = matchRes.aiExplanation
              ? `✨ ${formChangeMsg}AI 문맥 분석: ${matchRes.aiExplanation}`
              : `✨ ${formChangeMsg}본문 문맥에 가장 적절한 뜻('${selectedDef}')이 자동 선택되었습니다!`;

            updateWordEntry(entryId, {
              word: finalLemma,
              selectedMeaning: selectedDef,
              selectedPos: selectedPos,
              candidateSentences: sentences,
              context: matchRes.sentence,
              ocrDetectedNotice: noticeText,
            });
          } else {
            // 본문에 해당 단어가 없는 경우
            const isFormChanged = wordToSearch.toLowerCase() !== lemmaCandidate;
            const noticeMsg = isFormChanged
              ? `💡 '${wordToSearch}'의 원형 표제어 '${lemmaCandidate}'(으)로 등록되었습니다. (원문 미발견으로 기본 예문 제공)`
              : `⚠️ 현재 본문(사진/기사)에 '${wordToSearch}' 단어가 없어 기본 예문이 입력되었습니다.`;

            updateWordEntry(entryId, {
              context: defaultExample,
              ocrDetectedNotice: noticeMsg,
            });
          }
        } catch (mErr) {
          console.warn('Sentence match error:', mErr);
          updateWordEntry(entryId, { ocrDetectedNotice: null });
        }
      }
    } catch (e) {
      console.error(e);
      updateWordEntry(entryId, { isSearchingDict: false });
    }
  }

  function handleSelectCandidateForEntry(entryId: string, word: string) {
    updateWordEntry(entryId, { word });
    executeSearchForEntry(entryId, word);
  }

  // 원문(사진 OCR / 웹 기사) 텍스트를 단어 및 구두점으로 분리하여 인터랙티브 토큰 배열 생성
  const textTokens = useMemo(() => {
    if (!pageOcrText) return [];
    const tokens: { raw: string; cleanWord?: string; isWord: boolean }[] = [];
    const regex = /([a-zA-Z]+(?:['’-][a-zA-Z]+)*)|([^a-zA-Z]+)/g;
    let match;
    while ((match = regex.exec(pageOcrText)) !== null) {
      if (match[1]) {
        const raw = match[1];
        tokens.push({
          raw,
          cleanWord: raw.toLowerCase(),
          isWord: raw.length >= 2,
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

  function handleToggleWordFromText(word: string) {
    const clean = word.toLowerCase().trim();
    if (!clean) return;
    setSelectedWordsFromText((prev) =>
      prev.includes(clean) ? prev.filter((w) => w !== clean) : [...prev, clean]
    );
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

  // Save All Words to Vocabulary
  async function handleSaveAllWords() {
    const validEntries = wordEntries.filter(
      (e) => (e.dictResult?.word || e.word.trim()) && e.selectedMeaning
    );

    if (validEntries.length === 0) {
      alert('저장할 단어의 뜻을 먼저 선택해 주세요!');
      return;
    }

    const bookToSave = inputBookTitle.trim() || '기본 단어장';

    for (const entry of validEntries) {
      const finalWord = entry.dictResult?.word || entry.word.trim();
      const matchedContext =
        entry.context.trim() || `This sentence illustrates the word ${finalWord}.`;
      const finalCandidates =
        entry.candidateSentences.length > 0
          ? Array.from(new Set([matchedContext, ...entry.candidateSentences]))
          : [matchedContext];

      const newItem: VocabItem = {
        id: `${currentUser?.id ? currentUser.id + '_' : ''}vocab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        word: finalWord,
        phonetic: entry.dictResult?.phonetic || '',
        partOfSpeech: entry.selectedPos || '단어',
        selectedMeaning: entry.selectedMeaning,
        allMeanings: entry.dictResult ? entry.dictResult.meanings.map((m) => m.def) : [entry.selectedMeaning],
        contextSentence: matchedContext,
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

      await saveOrMergeVocabularyItem(newItem, currentUser?.id);
    }

    await loadData(currentUser);

    touchBookUsage(bookToSave);

    // Reset Form to 1 empty entry, but keep pageOcrText and loaded sources!
    setWordEntries([createWordEntryItem()]);
    setIsCustomBook(false);
    setCustomBookInput('');

    fireConfetti({ particleCount: 90, spread: 75, origin: { x: 0.35, y: 0.55 } });
    setTimeout(() => {
      fireConfetti({ particleCount: 90, spread: 75, origin: { x: 0.65, y: 0.55 } });
    }, 200);

    triggerToast(
      validEntries.length > 1
        ? `${validEntries.length}개 단어 저장/문맥 추가 완료! 🎉`
        : `'${validEntries[0].word}' 저장/문맥 추가 완료! 🎉`,
      `[${bookToSave}] 단어장에 반영되었습니다. 이미 등록된 단어는 새로운 원문 문장이 차곡차곡 누적됩니다.`
    );
  }

  // Save Single Word Entry to Vocabulary (신규 등록 및 기존 단어 문맥 누적 병합 지원)
  async function handleSaveSingleWordEntry(entryId: string) {
    const entry = wordEntries.find((e) => e.id === entryId);
    if (!entry) return;

    const finalWord = (entry.dictResult?.word || entry.word || '').trim();
    if (!finalWord) {
      alert('저장할 단어를 먼저 입력하거나 선택해 주세요!');
      return;
    }

    // 한국어 뜻 확인: 선택된 뜻이 없으면 첫 번째 사전 뜻 자동 채택
    let selectedDef = entry.selectedMeaning;
    let selectedPos = entry.selectedPos;
    if (!selectedDef) {
      if (entry.dictResult && entry.dictResult.meanings.length > 0) {
        selectedDef = entry.dictResult.meanings[0].def;
        selectedPos = entry.dictResult.meanings[0].pos;
      } else {
        alert(`'${finalWord}'의 한국어 뜻을 먼저 선택해 주세요!`);
        return;
      }
    }

    const bookToSave = inputBookTitle.trim() || '기본 단어장';
    const matchedContext =
      entry.context.trim() || `This sentence illustrates the word ${finalWord}.`;
    const finalCandidates =
      entry.candidateSentences.length > 0
        ? Array.from(new Set([matchedContext, ...entry.candidateSentences]))
        : [matchedContext];

    const newItem: VocabItem = {
      id: `${currentUser?.id ? currentUser.id + '_' : ''}vocab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      word: finalWord,
      phonetic: entry.dictResult?.phonetic || '',
      partOfSpeech: selectedPos || '단어',
      selectedMeaning: selectedDef,
      allMeanings: entry.dictResult ? entry.dictResult.meanings.map((m) => m.def) : [selectedDef],
      contextSentence: matchedContext,
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
    await loadData(currentUser);
    touchBookUsage(bookToSave);

    // 단어 저장 후 해당 카드 정리:
    // 여러 카드 작성 중인 경우 -> 저장된 카드는 제거
    // 1개만 있던 경우 -> 해당 카드를 빈 칸으로 리셋
    if (wordEntries.length > 1) {
      setWordEntries((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      setWordEntries([createWordEntryItem()]);
    }

    fireConfetti({ particleCount: 75, spread: 65, origin: { x: 0.5, y: 0.55 } });
    if (saveResult.isMerged) {
      triggerToast(
        `'${finalWord}' 새 문맥 추가 완료! 📚`,
        `기존 단어장에 새로운 원문 문장이 누적되었습니다. (총 ${saveResult.totalSentences}개 문장 수집됨)`
      );
    } else {
      triggerToast(
        `'${finalWord}' 단어 저장 완료! 🎉`,
        `[${bookToSave}] 단어장에 성공적으로 추가되었습니다.`
      );
    }
  }

  // Delete Item
  async function handleDeleteWord(id: string) {
    if (!confirm('이 단어를 단어장에서 삭제할까요?')) return;
    await deleteVocabularyItem(id, currentUser?.id);
    await loadData(currentUser);
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

  // Quiz Logic
  function startQuiz(targetBook?: string, mode?: 'smart' | 'wrong' | 'recent' | 'all') {
    const bookFilter = targetBook || selectedBookFilter;
    const currentMode = mode || quizMode;
    setQuizMode(currentMode);

    let pool = vocabulary;

    if (bookFilter && bookFilter !== 'all') {
      const filtered = vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === bookFilter);
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

    setQuizList(selectedList);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setIsQuizFinished(false);
    setActiveTab('quiz');
    setupQuestion(0, selectedList);
  }

  function setupQuestion(index: number, list: VocabItem[]) {
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

    // Options: 1 correct + 4 distractors (다른 단어장 뜻을 우선 교차 배치하여 헷갈리게 구성)
    const correct = current.selectedMeaning;
    const opts = [correct];

    const currentBook = current.bookTitle || '기본 단어장';

    // 1순위: '다른 단어장(책/레포트)'에 등록된 단어들의 뜻을 우선 선별 (헷갈리는 매력적인 오답)
    const otherBookMeanings = vocabulary
      .filter((v) => (v.bookTitle || '기본 단어장') !== currentBook && v.word !== current.word)
      .map((v) => v.selectedMeaning);
    const shuffledOtherBooks = [...otherBookMeanings].sort(() => 0.5 - Math.random());
    for (const m of shuffledOtherBooks) {
      if (!opts.includes(m) && opts.length < 5) opts.push(m);
    }

    // 2순위: 같은 단어장 내의 다른 단어 뜻 선별
    const sameBookMeanings = vocabulary
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

    setQuizAnswerState({ answered: true, chosen, isCorrect });

    // 퀴즈 통계 자동 업데이트 (푼 횟수 + 맞춘 횟수 + 오답 횟수 + 연속 정답 + 마지막 퀴즈일자)
    await updateQuizStat(current.id, isCorrect, currentUser?.id);
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

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      fireConfetti({ particleCount: 50, spread: 60, origin: { x: 0.5, y: 0.6 } });

      // 정답 선택 즉시 지연 없이 원문 문장 원어민 고음질 낭독 시작
      const textToRead = quizActiveSentence?.trim() || current.contextSentence?.trim() || current.word;
      speakSentenceTTS(textToRead, ttsVoice);
    }
  }

  function handleNextQuestion() {
    const nextIdx = currentQuizIndex + 1;
    setCurrentQuizIndex(nextIdx);
    setupQuestion(nextIdx, quizList);
  }

  // Highlight word helper
  function renderHighlightedContext(text: string, word: string) {
    if (!text || !word) return text;
    const regex = new RegExp(`(${word}[a-z]*)`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
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
    const rawTitles = Array.from(
      new Set(
        [
          inputBookTitle,
          ...vocabulary.map((v) => v.bookTitle || '기본 단어장'),
        ].filter(Boolean)
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

  // Filtered vocabulary list
  const filteredVocabulary =
    selectedBookFilter === 'all'
      ? vocabulary
      : vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === selectedBookFilter);

  const currentQuizItem = quizList[currentQuizIndex];

  return (
    <>
      {/* Header (Mobile First Clean 2-Tier Structure) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Logo - Styled identically to leegwajang.com signature logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#5090B3] text-[#F3D372] flex items-center justify-center font-black text-base shadow-sm ring-1 ring-[#417897]/20 select-none">
              이
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base text-slate-900 tracking-tight leading-none">
                  ContextVocab
                </h1>
                <span className="hidden sm:inline-block text-[10px] bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.5 rounded font-bold">
                  이과장 영한 단어장
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block mt-0.5">
                원서·레포트 영한 단어장 & 5지선다 퀴즈
              </p>
            </div>
          </div>

          {/* Right Utility Controls (AI Badge, Google Auth & Settings) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {geminiApiKey ? (
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 px-2 sm:px-2.5 py-1.5 rounded-xl flex items-center gap-1 font-bold transition cursor-pointer"
                title="Google Gemini AI 연결됨"
              >
                <Bot className="w-3.5 h-3.5 text-brand-600" />
                <span className="hidden sm:inline">AI 켜짐</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="text-xs bg-gradient-to-r from-brand-600 to-brand-500 text-white px-2 sm:px-2.5 py-1.5 rounded-xl flex items-center gap-1 font-bold shadow-xs hover:opacity-95 transition cursor-pointer"
                title="Google Gemini AI 무료 연동"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F3D372]" />
                <span className="hidden sm:inline">AI 연동</span>
              </button>
            )}

            {/* Google Authentication (Login or User Profile) */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer border border-slate-200 shadow-2xs"
                  title={currentUser.email || '사용자 프로필'}
                >
                  {currentUser.user_metadata?.avatar_url ? (
                    <img
                      src={currentUser.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-5 h-5 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {(currentUser.user_metadata?.full_name || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-xs font-bold max-w-[85px] truncate">
                    {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 space-y-1 animate-fade-in text-xs">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="font-bold text-slate-900 truncate">
                          {currentUser.user_metadata?.full_name || '로그인 사용자'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                          <Cloud className="w-3 h-3" />
                          <span>개인 클라우드 동기화 중</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSyncWordsToCloud}
                        disabled={isSyncingWords}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>{isSyncingWords ? '동기화 중...' : '게스트 단어 내 계정으로 가져오기'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleImportSamples}
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>샘플 단어 5개 추가</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 font-bold rounded-xl flex items-center gap-2 transition cursor-pointer border-t border-slate-100"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>로그아웃</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLoginClick}
                disabled={isLoggingIn}
                className="text-xs bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold shadow-2xs transition cursor-pointer active:scale-95 shrink-0"
                title="Google 계정으로 로그인하여 개인별 단어장을 클라우드에 보관하세요"
              >
                <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Google 로그인</span>
                <span className="sm:hidden text-[11px]">로그인</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="설정"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3-Tab Bar (Equal 3 Columns, Never Wraps, 100% Mobile Optimized) */}
        <div className="max-w-5xl mx-auto px-4 pb-2">
          <nav className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-center">
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`py-2 px-1 text-xs rounded-lg transition font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
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
              className={`py-2 px-1 text-xs rounded-lg transition font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>단어장</span>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {vocabulary.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => startQuiz()}
              className={`py-2 px-1 text-xs rounded-lg transition font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>5지선다 🎯</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-3.5 sm:px-4 py-3 sm:py-4 flex-1 overflow-x-hidden">

        {/* ========================================= */}
        {/* TAB 1: ADD WORD & CONTEXT */}
        {/* ========================================= */}
        {activeTab === 'add' && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="max-w-2xl mx-auto space-y-4">
                {/* Book Title Selection / Input */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <BookMarked className="w-3.5 h-3.5 text-indigo-600" />
                      <span>저장할 단어장 선택 <span className="text-rose-500">*</span></span>
                    </label>
                  </div>

                  {/* 선택형 드롭다운 */}
                  <select
                    value={isCustomBook ? '__custom__' : inputBookTitle}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomBook(true);
                      } else {
                        setIsCustomBook(false);
                        setInputBookTitle(e.target.value);
                        touchBookUsage(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
                  >
                    {availableBookTitles.map((title) => (
                      <option key={title} value={title}>
                        📖 {title}
                      </option>
                    ))}
                    <option value="__custom__">➕ + 새 단어장 직접 추가하기...</option>
                  </select>

                  {/* 새 단어장 직접 입력란 (필요할 때만 펼쳐짐) */}
                  {isCustomBook && (
                    <div className="mt-2 animate-fade-in w-full">
                      <input
                        type="text"
                        value={customBookInput}
                        onChange={(e) => {
                          setCustomBookInput(e.target.value);
                          setInputBookTitle(e.target.value);
                        }}
                        placeholder="새 단어장/책 이름을 입력하세요 (예: 코스모스, 논문 2편)"
                        className="w-full px-3 py-2 text-xs bg-white text-slate-900 border-2 border-indigo-500 rounded-lg focus:outline-none font-bold"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Hidden File/Camera Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handlePagePhotoUpload}
                  className="hidden"
                />

                {/* Page Photo Capture / Web URL Scanner Card */}
                <div className="bg-gradient-to-r from-brand-50 to-brand-100/40 p-3 sm:p-3.5 rounded-xl border border-brand-200">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
                      <BookOpen className="w-4 h-4 text-brand-600" />
                      <span>원문 문장 불러오기</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {pageOcrText ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>{loadedSourceType === 'web' ? '웹페이지 로드됨' : '사진 인식됨'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          사진 촬영 or 웹 URL
                        </span>
                      )}
                    </div>
                  </div>

                  {isSourceProcessing ? (
                    <div className="py-2.5 px-3 bg-white/95 rounded-xl border border-indigo-200 shadow-xs space-y-1 animate-pulse">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                        <span>백그라운드에서 {sourceProcessTaskName || '원문'} 분석 중...</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        기다리지 말고 아래 단어를 바로 입력하세요! 분석 완료 시 문장이 자동 연결됩니다.
                      </p>
                    </div>
                  ) : pageOcrText ? (
                    <div className="space-y-2 pt-0.5">
                      <p className="text-[11px] text-slate-700 line-clamp-2 italic bg-white/90 p-2.5 rounded-lg border border-indigo-100 leading-relaxed font-serif">
                        &quot;{pageOcrText.slice(0, 140)}...&quot;
                      </p>
                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        {loadedSourceType === 'camera' && (
                          <button
                            type="button"
                            onClick={() => {
                              isAppendModeRef.current = true;
                              fileInputRef.current?.click();
                            }}
                            className="text-[11px] font-bold bg-[#5090B3] text-white hover:bg-[#3d7a9c] px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1 transition cursor-pointer"
                            title="문장이 다음 페이지로 이어질 때 다음 장을 찍어 문맥을 하나로 연결합니다"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ 다음 장 이어찍기</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            isAppendModeRef.current = false;
                            fileInputRef.current?.click();
                          }}
                          className="text-[11px] font-bold bg-white border border-slate-200 hover:border-[#5090B3] text-[#5090B3] px-2 py-1 rounded-md shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>새 사진</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUrlModalTab('url');
                            setIsUrlModalOpen(true);
                          }}
                          className="text-[11px] font-bold bg-white border border-slate-200 hover:border-indigo-400 text-indigo-600 px-2 py-1 rounded-md shadow-xs flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" />
                          <span>새 URL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUrlModalTab('paste');
                            setIsUrlModalOpen(true);
                          }}
                          className="text-[11px] font-bold bg-white border border-slate-200 hover:border-indigo-400 text-indigo-600 px-2 py-1 rounded-md shadow-xs flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>글 붙여넣기</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWordsFromText([]);
                            setIsWordSelectModalOpen(true);
                          }}
                          className="text-[11px] font-bold bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md shadow-xs flex items-center gap-1 transition"
                        >
                          <ScanLine className="w-3 h-3 text-indigo-600" />
                          <span>단어 선택</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPageOcrText('');
                            setLoadedSourceType(null);
                            setLoadedWebTitle('');
                            if (typeof window !== 'undefined') localStorage.removeItem('context_vocab_cached_page_ocr');
                          }}
                          className="text-[11px] text-slate-400 hover:text-rose-500 px-1 py-1"
                        >
                          지우기
                        </button>
                      </div>
                      </div>
                    ) : (
                    <div className="pt-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">
                        사진, 웹페이지 URL, 또는 복사한 기사를 넣으면 문장들이 자동으로 채워집니다.
                      </p>
                      <div className="grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-2.5 py-2 rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          <span>책 사진</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUrlModalTab('url');
                            setIsUrlModalOpen(true);
                          }}
                          className="bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-2.5 py-2 rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                        >
                          <Globe className="w-3.5 h-3.5 text-indigo-600" />
                          <span>웹 URL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUrlModalTab('paste');
                            setIsUrlModalOpen(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5 text-white" />
                          <span>기사 붙여넣기</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>


                {/* Multi-Word Form Cards List */}
                <div className="space-y-4">
                  {wordEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4"
                    >
                      {/* Entry Card Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            단어 등록칸 #{index + 1}
                          </span>
                          {entry.selectedMeaning && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full truncate max-w-[180px]">
                              ✓ {entry.word} ({entry.selectedMeaning})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* 단어별 빠른 저장 버튼 */}
                          <button
                            type="button"
                            onClick={() => handleSaveSingleWordEntry(entry.id)}
                            disabled={!((entry.dictResult?.word || entry.word.trim()) && (entry.selectedMeaning || (entry.dictResult?.meanings && entry.dictResult.meanings.length > 0)))}
                            className={`text-xs font-bold px-2.5 sm:px-3 py-1 rounded-xl shadow-2xs transition flex items-center gap-1 cursor-pointer ${
                              (entry.dictResult?.word || entry.word.trim()) && (entry.selectedMeaning || (entry.dictResult?.meanings && entry.dictResult.meanings.length > 0))
                                ? 'bg-[#5090B3] hover:bg-[#417897] text-white active:scale-95'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            title="이 단어를 단어장에 바로 저장합니다"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>저장</span>
                          </button>
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

                        <div className="flex gap-2">
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
                            className="flex-1 px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => executeSearchForEntry(entry.id)}
                            disabled={entry.isSearchingDict}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 text-xs rounded-xl shadow-xs transition flex items-center gap-1 shrink-0 disabled:opacity-50"
                          >
                            <Search className="w-3.5 h-3.5" />
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

                            <div className="text-[11px] text-slate-500 font-medium">
                              💡 원문 문맥에 가장 어울리는 한국어 뜻을 골라주세요:
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {entry.dictResult.meanings.map((m, idx) => (
                                <label
                                  key={idx}
                                  onClick={() => {
                                    updateWordEntry(entry.id, {
                                      selectedMeaning: m.def,
                                      selectedPos: m.pos,
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
                                        selectedPos: m.pos,
                                      });
                                    }}
                                    className="mt-0.5 accent-indigo-600"
                                  />
                                  <div className="flex-1 flex items-center justify-between gap-1.5">
                                    <div>
                                      <span className={`inline-block px-2 py-0.5 font-bold rounded-md text-[10px] mr-1.5 border ${getPosBadgeColor(m.pos)}`}>
                                        {m.pos}
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
                              ))}
                            </div>

                            {/* 직접 입력 */}
                            <details className="text-xs text-slate-600 cursor-pointer pt-1">
                              <summary className="font-semibold text-indigo-600 hover:underline text-[11px]">
                                원하는 뜻이 없나요? 직접 입력하기
                              </summary>
                              <div className="mt-1.5 flex gap-1.5">
                                <input
                                  type="text"
                                  value={entry.customMeaning}
                                  onChange={(e) => updateWordEntry(entry.id, { customMeaning: e.target.value })}
                                  placeholder="직접 한국어 뜻 입력"
                                  className="flex-1 px-2 py-1 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!entry.customMeaning.trim()) return;
                                    updateWordEntry(entry.id, {
                                      selectedMeaning: entry.customMeaning.trim(),
                                      selectedPos: '직접입력',
                                    });
                                  }}
                                  className="px-2.5 py-1 bg-slate-800 text-white text-xs font-bold rounded-lg shrink-0"
                                >
                                  적용
                                </button>
                              </div>
                            </details>
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
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-slate-700">
                                원서 / 레포트 원문 문장 <span className="text-slate-400 font-normal">(권장)</span>
                              </label>
                              {entry.ocrDetectedNotice && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded animate-fade-in ${
                                    entry.ocrDetectedNotice.includes('⚠️')
                                      ? 'text-amber-800 bg-amber-50 border border-amber-200'
                                      : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                  }`}
                                >
                                  {entry.ocrDetectedNotice}
                                </span>
                              )}
                            </div>

                            {/* 복수 문장 발견 시 선택 리스트 */}
                            {entry.candidateSentences.length > 1 && (
                              <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200 space-y-1.5 mb-2">
                                <div className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>본문 내 {entry.candidateSentences.length}개 문장 중 대표 문맥 선택:</span>
                                </div>
                                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                  {entry.candidateSentences.map((sent, sIdx) => {
                                    const isChosen = entry.context.trim() === sent.trim();
                                    return (
                                      <button
                                        key={sIdx}
                                        type="button"
                                        onClick={() => updateWordEntry(entry.id, { context: sent })}
                                        className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-start gap-2 cursor-pointer ${
                                          isChosen
                                            ? 'bg-white border-indigo-600 ring-2 ring-indigo-200 font-bold text-slate-900 shadow-xs'
                                            : 'bg-white/80 border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-white'
                                        }`}
                                      >
                                        <span
                                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${
                                            isChosen ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                                          }`}
                                        >
                                          {sIdx + 1}
                                        </span>
                                        <span className="flex-1 font-serif leading-relaxed line-clamp-2">
                                          &quot;{sent}&quot;
                                        </span>
                                        {isChosen && (
                                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold shrink-0">
                                            선택됨 ✓
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 잘린 문장 감지 및 AI 자연스러운 완성 버튼 */}
                            {entry.context && (
                              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                                <span className="text-[10px] text-slate-400">
                                  {(!/[.!?]["'”’]?$/.test(entry.context.trim()) || /^[a-z]/.test(entry.context.trim())) && (
                                    <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      ⚠️ 페이지 경계로 문장이 잘린 것 같습니다
                                    </span>
                                  )}
                                </span>
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
                                  className="text-[10px] bg-sky-50 border border-[#5090B3]/50 text-[#3d7a9c] hover:bg-[#5090B3] hover:text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 transition cursor-pointer ml-auto shadow-2xs disabled:opacity-50"
                                  title="페이지 경계나 여백으로 잘린 문장을 AI가 자연스러운 완전한 문장으로 복원합니다"
                                >
                                  {completingSentenceId === entry.id ? (
                                    <>
                                      <RotateCw className="w-2.5 h-2.5 animate-spin text-[#3d7a9c]" />
                                      <span>문장 완성 중...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-2.5 h-2.5 text-[#5090B3]" />
                                      <span>잘린 문장 AI 완성 ✨</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            <textarea
                              rows={2}
                              value={entry.context}
                              onChange={(e) => {
                                updateWordEntry(entry.id, {
                                  context: e.target.value,
                                  ocrDetectedNotice: null,
                                });
                              }}
                              placeholder="예: It was an unspeakable tragedy that shook the entire nation. (사진이나 웹 URL을 넣으면 자동 입력됩니다)"
                              className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                            />
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
                          {entry.selectedMeaning ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>선택된 뜻: <strong>{entry.selectedMeaning}</strong> ({entry.selectedPos || '단어'})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">💡 한국어 뜻을 선택하면 단어장에 즉시 저장할 수 있습니다.</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveSingleWordEntry(entry.id)}
                          disabled={!((entry.dictResult?.word || entry.word.trim()) && (entry.selectedMeaning || (entry.dictResult?.meanings && entry.dictResult.meanings.length > 0)))}
                          className={`w-full sm:w-auto font-bold px-4 py-2 text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 ${
                            (entry.dictResult?.word || entry.word.trim()) && (entry.selectedMeaning || (entry.dictResult?.meanings && entry.dictResult.meanings.length > 0))
                              ? 'bg-[#5090B3] hover:bg-[#417897] text-white cursor-pointer active:scale-95'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>&apos;{entry.word || entry.dictResult?.word || `단어 #${index + 1}`}&apos; 저장하기</span>
                        </button>
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
                  const validCount = wordEntries.filter(
                    (e) => (e.dictResult?.word || e.word.trim()) && e.selectedMeaning
                  ).length;
                  return (
                    <div className="pt-3 mt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 text-center sm:text-left">
                        작성 중인 <span className="font-bold text-indigo-600">{wordEntries.length}개</span> 등록칸 중{' '}
                        <span className="font-bold text-emerald-600">{validCount}개</span> 단어 저장 준비 완료
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveAllWords}
                        disabled={validCount === 0 || isSavingAwaitingSource}
                        className={`w-full sm:w-auto font-bold px-6 py-2.5 text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 ${
                          validCount > 0
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isSavingAwaitingSource ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>원문 문장 분석 대기 중...</span>
                          </>
                        ) : (
                          <span>
                            ⭐ [{inputBookTitle || '기본 단어장'}]에 {validCount > 1 ? `${validCount}개 단어 일괄 ` : '단어 '}저장하기
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })()}
            </div>
          </section>
        )}

        {/* ========================================= */}
        {/* TAB 2: VOCABULARY LIST */}
        {/* ========================================= */}
        {activeTab === 'list' && (
          <section className="space-y-4">
            {/* Top Header & Dropdown Selector */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>내 문맥 영한 단어장</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                    총 {vocabulary.length}단어 ({availableBookTitles.length}개 단어장)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  단어장 목록에서 책·레포트를 선택하고 바로 퀴즈를 풀 수 있습니다.
                </p>
              </div>

              {/* Dropdown Selector & Quick Quiz Button */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <select
                    value={selectedBookFilter}
                    onChange={(e) => {
                      setSelectedBookFilter(e.target.value);
                      if (e.target.value !== 'all') {
                        touchBookUsage(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">📚 전체 단어장 보기 (총 {vocabulary.length}단어)</option>
                    {availableBookTitles.map((title) => {
                      const count = vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === title).length;
                      return (
                        <option key={title} value={title}>
                          📖 {title} ({count}단어)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  onClick={() => startQuiz(selectedBookFilter)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {selectedBookFilter === 'all'
                      ? '🎯 전체 퀴즈 풀기'
                      : '🎯 이 단어장 퀴즈'}
                  </span>
                </button>
              </div>
            </div>

            {/* Deck List Hub & Instant Quiz Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>단어장 목록 ({availableBookTitles.length + 1}개)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  목록을 선택하면 아래 단어가 필터링되고 바로 퀴즈를 풀 수 있습니다
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {/* 1. Entire Vocab Card */}
                {(() => {
                  const isSelected = selectedBookFilter === 'all';
                  const totalQuiz = vocabulary.reduce((acc, v) => acc + (v.quizCount || 0), 0);
                  const totalCorrect = vocabulary.reduce((acc, v) => acc + (v.correctCount || 0), 0);
                  const accuracy = totalQuiz > 0 ? Math.round((totalCorrect / totalQuiz) * 100) : 0;

                  return (
                    <div
                      className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-400 shadow-xs ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Layers className="w-4 h-4 text-slate-700 shrink-0" />
                            <h4 className="text-xs font-black text-slate-900 truncate">
                              전체 단어장 보기
                            </h4>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            총 {vocabulary.length}단어
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          {totalQuiz > 0 ? (
                            <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <BarChart3 className="w-3 h-3" />
                              <span>정답률 {accuracy}% ({totalQuiz}회 풀이)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">퀴즈 미도전</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedBookFilter('all')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{isSelected ? '✓ 전체 보는 중' : '전체 단어 보기'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => startQuiz('all')}
                          className="py-1.5 px-3 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 transition flex items-center gap-1 shrink-0 cursor-pointer"
                          title="전체 단어로 퀴즈 풀기"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>전체 퀴즈</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Individual Book Decks */}
                {availableBookTitles.map((title) => {
                  const items = vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === title);
                  const isSelected = selectedBookFilter === title;
                  const deckQuiz = items.reduce((acc, v) => acc + (v.quizCount || 0), 0);
                  const deckCorrect = items.reduce((acc, v) => acc + (v.correctCount || 0), 0);
                  const accuracy = deckQuiz > 0 ? Math.round((deckCorrect / deckQuiz) * 100) : 0;

                  return (
                    <div
                      key={title}
                      className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-400 shadow-xs ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <BookMarked className="w-4 h-4 text-indigo-600 shrink-0" />
                            <h4 className="text-xs font-black text-slate-900 truncate" title={title}>
                              {title}
                            </h4>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {items.length}단어
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          {deckQuiz > 0 ? (
                            <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <BarChart3 className="w-3 h-3" />
                              <span>정답률 {accuracy}% ({deckQuiz}회 풀이)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">퀴즈 미도전</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedBookFilter(title)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{isSelected ? '✓ 보는 중' : '단어 보기'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => startQuiz(title)}
                          className="py-1.5 px-3 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 transition flex items-center gap-1 shrink-0 cursor-pointer"
                          title={`[${title}] 퀴즈 풀기`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>퀴즈</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filtered Word Header Notice */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>
                    {selectedBookFilter === 'all'
                      ? '전체 단어 목록'
                      : `[${selectedBookFilter}] 단어 목록`}
                  </span>
                </span>
                <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  {filteredVocabulary.length}개
                </span>
              </div>

              {selectedBookFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedBookFilter('all')}
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
                  {selectedBookFilter === 'all'
                    ? '저장된 단어가 아직 없습니다.'
                    : `'${selectedBookFilter}' 단어장에 단어가 없습니다.`}
                </h3>
                <p className="text-xs text-slate-400 mb-4">원서를 읽다가 모르는 단어를 등록해 보세요!</p>
                <button
                  onClick={() => setActiveTab('add')}
                  className="bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  첫 단어 등록하러 가기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVocabulary.map((item) => {
                  const qCount = item.quizCount || 0;
                  const cCount = item.correctCount || 0;
                  const accuracy = qCount > 0 ? Math.round((cCount / qCount) * 100) : 0;

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div>
                        {/* Book Badge & Quiz Stats Banner */}
                        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1 truncate max-w-[200px]">
                            <BookMarked className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.bookTitle || '기본 단어장'}</span>
                          </span>

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
                                    <span className="text-[10px] bg-sky-100 text-[#3d7a9c] px-1.5 py-0.5 rounded-full font-bold">
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
                                      className="text-[10px] bg-white border border-[#5090B3]/40 text-[#3d7a9c] hover:bg-[#5090B3] hover:text-white px-2 py-0.5 rounded font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
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
                                  className="text-[10px] text-[#5090B3] hover:underline flex items-center gap-0.5 font-bold cursor-pointer ml-auto"
                                >
                                  <Volume2 className="w-3 h-3" />
                                  <span>문장 듣기</span>
                                </button>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed font-serif">
                                {renderHighlightedContext(viewingSentence, item.word)}
                              </p>

                              {/* 전체 수집된 문맥 목록 (접이식) */}
                              {allSentences.length > 1 && (
                                <details className="pt-2 border-t border-slate-200/80 text-xs text-slate-600 group">
                                  <summary className="cursor-pointer font-bold text-[#5090B3] hover:text-[#3d7a9c] flex items-center gap-1 text-[11px]">
                                    <Sparkles className="w-3 h-3 text-[#5090B3]" />
                                    <span>수집된 전체 문맥 ({allSentences.length}개 보관됨)</span>
                                  </summary>
                                  <div className="mt-2 space-y-1.5 pl-1.5 border-l-2 border-[#5090B3]/30">
                                    {allSentences.map((sent, sIdx) => {
                                      const isCurrentViewing = viewingSentence.trim() === sent.trim();
                                      const isSentPrimary = item.contextSentence.trim() === sent.trim();
                                      return (
                                        <div
                                          key={sIdx}
                                          className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                            isCurrentViewing
                                              ? 'bg-[#5090B3]/10 border-[#5090B3]/50 font-bold text-slate-900 shadow-2xs'
                                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                          }`}
                                        >
                                          <p className="flex-1 font-serif text-[11px] leading-relaxed">
                                            &quot;{sent}&quot;
                                          </p>
                                          <div className="flex items-center gap-1 shrink-0 self-start sm:self-auto">
                                            {isSentPrimary && (
                                              <span className="text-[10px] bg-[#5090B3] text-white px-2 py-0.5 rounded font-bold">
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
                                                className="text-[10px] bg-white border border-slate-300 text-slate-600 hover:border-[#5090B3] hover:text-[#5090B3] px-2 py-0.5 rounded font-medium transition cursor-pointer"
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
                                                className="text-[10px] bg-white border border-[#5090B3]/40 text-[#5090B3] hover:bg-[#5090B3] hover:text-white px-2 py-0.5 rounded font-bold transition cursor-pointer"
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
        )}

        {/* ========================================= */}
        {/* TAB 3: 5-CHOICE QUIZ */}
        {/* ========================================= */}
        {activeTab === 'quiz' && (
          <section className="max-w-2xl mx-auto space-y-4">
            {/* 퀴즈 모드 선택 바 (스마트 복습 / 오답 격파 / 최근 단어 / 전체 랜덤) */}
            <div className="bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between sm:justify-start gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => startQuiz(selectedBookFilter, 'smart')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  quizMode === 'smart'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>🧠 스마트 복습</span>
              </button>
              <button
                onClick={() => startQuiz(selectedBookFilter, 'wrong')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  quizMode === 'wrong'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>🔥 오답 격파</span>
              </button>
              <button
                onClick={() => startQuiz(selectedBookFilter, 'recent')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  quizMode === 'recent'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>🆕 최근 단어</span>
              </button>
              <button
                onClick={() => startQuiz(selectedBookFilter, 'all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  quizMode === 'all'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>🎲 전체 랜덤</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
              {/* Quiz Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold">
                    {quizMode === 'smart'
                      ? '🧠 스마트 복습'
                      : quizMode === 'wrong'
                      ? '🔥 오답 격파'
                      : quizMode === 'recent'
                      ? '🆕 최근 단어'
                      : '🎲 전체 랜덤'}
                  </span>
                  <span className="text-xs text-slate-300">
                    문제 {Math.min(currentQuizIndex + 1, quizList.length)} / {quizList.length}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 font-bold">정답: {quizScore}개</span>
                </div>
              </div>

              {/* Quiz Body */}
              <div className="p-6">
                {!isQuizFinished && currentQuizItem ? (
                  <>
                    <div className="text-center py-3 border-b border-slate-100">
                      <div className="mb-2 flex items-center justify-center gap-1.5 flex-wrap">
                        <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                          <BookMarked className="w-3 h-3" />
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
                            <div className="bg-amber-50/95 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                                    📖 원서 / 레포트 속 실제 원문 문맥
                                  </span>
                                  {currentQuizAllSentences.length > 1 && (
                                    <span className="text-[10px] bg-amber-200/90 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                                      문장 {quizSentenceIdx + 1}/{currentQuizAllSentences.length}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {currentQuizAllSentences.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextIdx = (quizSentenceIdx + 1) % currentQuizAllSentences.length;
                                        setQuizSentenceIdx(nextIdx);
                                        const nextSentence = currentQuizAllSentences[nextIdx];
                                        setQuizActiveSentence(nextSentence);
                                        speakSentenceTTS(nextSentence, ttsVoice);
                                      }}
                                      className="text-xs bg-amber-200/90 hover:bg-amber-300 text-amber-900 font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition shadow-2xs cursor-pointer active:scale-95"
                                      title="이 단어가 쓰인 다른 원문 문맥으로 번갈아가며 봅니다"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>번갈아 보기</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => speakSentenceTTS(activeSentence, ttsVoice)}
                                    className="text-xs bg-amber-200/90 hover:bg-amber-300 text-amber-900 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>듣기</span>
                                  </button>
                                </div>
                              </div>
                              <p className="text-base text-slate-800 leading-relaxed font-serif pt-1">
                                {renderHighlightedContext(activeSentence, currentQuizItem.word)}
                              </p>
                              <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 text-xs text-slate-500">
                                <span>출처: {currentQuizItem.sourceMemo || '원서'}</span>
                                <button
                                  onClick={() => speakWordTTS(currentQuizItem.word, ttsVoice)}
                                  className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                >
                                  <Volume2 className="w-3 h-3" />
                                  <span>단어만 다시 듣기</span>
                                </button>
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
                        onClick={() => startQuiz(selectedBookFilter, quizMode)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition"
                      >
                        현재 모드로 다시 풀기 🔄
                      </button>
                      <button
                        onClick={() => startQuiz(selectedBookFilter, 'smart')}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition"
                      >
                        🧠 스마트 복습
                      </button>
                      <button
                        onClick={() => startQuiz(selectedBookFilter, 'wrong')}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition"
                      >
                        🔥 오답만 격파
                      </button>
                      <button
                        onClick={() => setActiveTab('list')}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                      >
                        단어장 확인
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Web Page URL & Article Paste Modal */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-indigo-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md">
                  {urlModalTab === 'url' ? <Globe className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                    {urlModalTab === 'url' ? '웹페이지 URL로 원문 가져오기' : '기사 본문 직접 붙여넣기'}
                  </h3>
                  <p className="text-[11px] text-indigo-600 font-semibold">
                    {urlModalTab === 'url'
                      ? '기사 주소만 넣으면 본문 문맥을 자동 연결합니다'
                      : '유료/로그인 기사도 복사해 넣으면 AI가 광고를 자동 삭제합니다'}
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

            {/* Tab Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mt-3 shrink-0">
              <button
                type="button"
                onClick={() => setUrlModalTab('url')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  urlModalTab === 'url'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>웹 URL 입력</span>
              </button>
              <button
                type="button"
                onClick={() => setUrlModalTab('paste')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  urlModalTab === 'paste'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>본문 직접 붙여넣기</span>
                <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded font-black">로그인/유료용</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3.5">
              {urlModalTab === 'url' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      웹페이지 주소 (URL)
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={inputWebUrl}
                        onChange={(e) => {
                          setInputWebUrl(e.target.value);
                          setUrlScrapeError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleScrapeUrl();
                        }}
                        placeholder="예: https://www.bbc.com/news/... 또는 영문 기사 URL"
                        className="w-full px-4 py-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-10"
                      />
                      {inputWebUrl && (
                        <button
                          type="button"
                          onClick={() => setInputWebUrl('')}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
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
                            setInputWebUrl(sample.url);
                            setUrlScrapeError(null);
                          }}
                          className="text-[10px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition cursor-pointer"
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {urlScrapeError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{urlScrapeError}</span>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <p className="font-bold text-slate-800">💡 웹 URL 안내:</p>
                    <p>• 공개 기사는 URL만 넣으면 AI가 본문 문장들을 자동으로 긁어옵니다.</p>
                    <p>• 로그인이 필요한 유료 사이트(WSJ, NYT 등)는 상단의 <b>[본문 직접 붙여넣기]</b>를 이용하세요!</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      기사/출처 제목 <span className="font-normal text-slate-400 text-[10px]">(선택 사항)</span>
                    </label>
                    <input
                      type="text"
                      value={inputPastedTitle}
                      onChange={(e) => setInputPastedTitle(e.target.value)}
                      placeholder="예: WSJ 기사 제목, NYT 칼럼 등"
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        기사 본문 내용 <span className="text-rose-500">*</span>
                      </label>
                      {inputPastedText && (
                        <button
                          type="button"
                          onClick={() => setInputPastedText('')}
                          className="text-[10px] text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          지우기
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={7}
                      value={inputPastedText}
                      onChange={(e) => setInputPastedText(e.target.value)}
                      placeholder="신문 사이트에서 복사한 본문 전체를 여기에 편하게 붙여넣으세요. 중간에 낀 광고, 배너 문구, 구독 권유 글은 AI가 자동으로 깔끔하게 삭제해 드립니다!"
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-serif leading-relaxed"
                    />
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
                        <span>중간 광고 및 구독 안내 문구 자동 삭제 & 정제</span>
                      </span>
                      <p className="text-[10px] text-slate-500">
                        기사 복사 시 딸려온 &quot;Advertisement&quot;, &quot;Subscribe&quot;, 소셜 링크를 깨끗하게 지웁니다.
                      </p>
                    </div>
                  </label>
                </>
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

              {urlModalTab === 'url' ? (
                <button
                  type="button"
                  onClick={handleScrapeUrl}
                  disabled={isUrlScraping || !inputWebUrl.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isUrlScraping ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>본문 문장 분석 중...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>문장 불러오기</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyPastedText}
                  disabled={isCleaningPastedText || !inputPastedText.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isCleaningPastedText ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>광고 삭제 및 본문 정제 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{autoRemoveAds ? '광고 자동삭제 후 본문 등록' : '본문 등록하기'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Word Selection from Loaded Text Modal (원문에서 단어 직접 클릭 선택 모달) */}
      {isWordSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-indigo-100 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                    원문에서 모르는 단어 선택
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    본문 속 단어를 터치하여 고른 뒤 단어장에 담으세요
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWordSelectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Text Body */}
            <div className="flex-1 overflow-y-auto pr-1 py-1 min-h-[160px]">
              <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-[13px] sm:text-[14px] leading-relaxed text-slate-800 font-serif whitespace-pre-wrap select-none">
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
                        onClick={() => handleToggleWordFromText(clean)}
                        className={`inline font-sans rounded px-0.5 py-0 text-xs sm:text-[13px] transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold px-1 py-0.5 shadow-xs'
                            : isAlreadyAdded
                            ? 'bg-emerald-100 text-emerald-800 font-medium px-1 py-0.5'
                            : 'text-slate-900 underline decoration-indigo-300 decoration-1 underline-offset-2 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                        title={isAlreadyAdded ? '이미 단어칸에 등록됨' : '클릭하여 선택'}
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
            </div>

            {/* Bottom Actions / Selected Words Chips */}
            <div className="pt-3 border-t border-slate-100 mt-3 space-y-2.5 shrink-0">
              {/* Selected Words Chips Bar */}
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
                    onClick={() => setSelectedWordsFromText([])}
                    className="text-[11px] text-slate-400 hover:text-rose-500 font-medium transition cursor-pointer"
                  >
                    전체 해제
                  </button>
                )}
              </div>

              {selectedWordsFromText.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
                  {selectedWordsFromText.map((word) => {
                    const lemma = extractLemmaCandidate(word);
                    const isChanged = lemma.toLowerCase() !== word.toLowerCase();
                    return (
                      <span
                        key={word}
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
                          onClick={() => handleToggleWordFromText(word)}
                          className="text-indigo-400 hover:text-rose-500 text-[10px] font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  위 본문에서 외우고 싶은 영단어를 탭하세요.
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsWordSelectModalOpen(false)}
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
                      : '단어를 터치해 선택하세요'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated AI Setup Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-brand-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-[#F3D372] flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    Google Gemini AI 원클릭 연동
                  </h3>
                  <p className="text-[11px] text-brand-600 font-semibold">
                    책 사진 오타 교정 & 복수/시제 변화형 문맥 자동 탐색
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Benefits Explanation */}
            <div className="bg-brand-50/70 rounded-2xl p-4 border border-brand-200/80 space-y-2 text-xs text-slate-800">
              <h4 className="font-black text-xs text-brand-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#5090B3]" />
                <span>AI 연동 시 이런 점이 강력해집니다:</span>
              </h4>
              <ul className="space-y-1.5 text-[11px] text-slate-700 leading-relaxed pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-600 font-bold">1.</span>
                  <span><strong>사진 오타·줄바꿈 100% 자동 교정</strong>: 모바일 카메라로 대충 찍어도 흐릿한 글자, 잘린 하이픈(con- / dition)을 자연스러운 문장으로 복원합니다.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-600 font-bold">2.</span>
                  <span><strong>문맥 속 변화형 자동 감지</strong>: 단어를 원형(party, run)으로 입력해도 책 속의 복수형(parties), 과거형(ran), 분사형 등을 AI가 문맥에서 스스로 찾아냅니다.</span>
                </li>
              </ul>
            </div>

            {/* Step-by-Step API Key Entry */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-brand-600" />
                  <span>Gemini API Key 등록 (신용카드 불필요 · 평생 무료)</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-brand-600 hover:text-brand-800 font-bold underline flex items-center gap-1"
                >
                  <span>무료 키 발급받기 (30초)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => {
                    setGeminiKeyInput(e.target.value);
                    setKeyTestStatus(null);
                  }}
                  placeholder="AIzaSy... (발급받은 키를 여기에 붙여넣으세요)"
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                />
                <button
                  type="button"
                  onClick={() => handleSaveAndTestAiKey()}
                  disabled={isTestingKey}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isTestingKey ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>검증중...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
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

              {/* Helper Notice for Chat Key Sharing */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>💡 키를 복사해서 채팅창에 알려주셔도 제가 서버에 바로 심어드릴 수 있습니다!</span>
                {geminiApiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setStoredGeminiKey('');
                      setGeminiApiKey('');
                      setGeminiKeyInput('');
                      setKeyTestStatus(null);
                      triggerToast('AI 키 해제됨', '기본 로컬 모드로 전환되었습니다.');
                    }}
                    className="text-rose-500 hover:underline font-semibold ml-2 shrink-0 cursor-pointer"
                  >
                    연동 해제
                  </button>
                )}
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-700" />
                <span>앱 설정 & Supabase 연동 안내</span>
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              {/* Supabase Status Info & Connect Button */}
              <div
                className={`p-3.5 rounded-xl border ${
                  isSupabaseReady
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    <span>
                      {isSupabaseReady
                        ? (currentUser ? '개인 클라우드 계정 연결됨 ☁️' : 'Supabase 클라우드 연동됨')
                        : 'Supabase 미연동 (로컬 스토리지 모드)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsSupabaseModalOpen(true);
                    }}
                    className="text-[11px] underline font-bold hover:opacity-80 cursor-pointer"
                  >
                    설정 열기
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {isSupabaseReady
                    ? (currentUser
                        ? `${currentUser.email} 계정으로 RLS 보안 격리된 개인 단어장이 실시간 동기화됩니다.`
                        : 'Google 로그인 시 사용자별 개인 단어장이 자동으로 클라우드에 백업됩니다.')
                    : 'Supabase URL과 Anon Key를 등록하면 Google 로그인 및 개인별 클라우드 격리 저장이 활성화됩니다.'}
                </p>
              </div>

              {/* Google Gemini AI Vision & Sentence Matcher Settings */}
              <div className="bg-brand-50/70 p-3.5 rounded-xl border border-brand-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Bot className="w-4 h-4 text-brand-600" />
                    <span>Google Gemini AI 비전 & 문맥 분석</span>
                  </span>
                  {geminiApiKey ? (
                    <span className="text-[10px] bg-brand-200 text-brand-800 font-bold px-2 py-0.5 rounded-full">
                      연동 활성화됨
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      미등록 (기본 모드)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Gemini API를 연동하면 책 사진의 오타·잘린 줄바꿈을 완벽히 복원하고, 단어의 복수형(parties)/과거형(walked) 등 형태소 변화형까지 AI가 문맥에서 스스로 찾아냅니다.
                </p>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="password"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy... (Gemini API 키 입력)"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-brand-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setStoredGeminiKey(geminiKeyInput);
                      setGeminiApiKey(geminiKeyInput.trim());
                      triggerToast(
                        geminiKeyInput.trim() ? 'AI 키 저장 완료! 🤖' : 'AI 키가 삭제되었습니다.',
                        geminiKeyInput.trim()
                          ? '책 사진 촬영 시 Gemini Vision과 AI 문장 추출이 적용됩니다.'
                          : '기본 로컬 엔진으로 작동합니다.'
                      );
                    }}
                    className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shrink-0 cursor-pointer"
                  >
                    저장
                  </button>
                  {geminiApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setStoredGeminiKey('');
                        setGeminiApiKey('');
                        setGeminiKeyInput('');
                        triggerToast('AI 키 삭제됨', '기본 로컬 모드로 전환되었습니다.');
                      }}
                      className="bg-white border border-brand-300 text-brand-700 hover:bg-brand-100 font-bold px-2.5 py-1.5 rounded-lg text-xs transition shrink-0 cursor-pointer"
                    >
                      해제
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between pt-0.5 text-[10px] text-brand-700">
                  <span>💡 개인용 무료 키 발급 (신용카드 불필요)</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline flex items-center gap-0.5 hover:text-brand-900"
                  >
                    <span>Google AI Studio 열기</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* TTS Voice Select */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block font-bold text-slate-800 mb-1">발음 음성(TTS) 악센트</label>
                <select
                  value={ttsVoice}
                  onChange={(e) => {
                    setTtsVoice(e.target.value);
                    localStorage.setItem('context_vocab_tts_voice', e.target.value);
                  }}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="en-US">영어 (미국식 - US)</option>
                  <option value="en-GB">영어 (영국식 - GB)</option>
                </select>
              </div>

              {/* Data Reset Options */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 mb-1">단어 데이터 관리</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={async () => {
                      if (!confirm('기본 샘플 단어로 초기화할까요?')) return;
                      await resetWithSamples();
                      await loadData();
                      setIsSettingsOpen(false);
                    }}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-semibold text-xs"
                  >
                    기본 샘플로 초기화
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('모든 단어를 비울까요?')) return;
                      await clearAllVocab();
                      await loadData();
                      setIsSettingsOpen(false);
                    }}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-semibold text-xs"
                  >
                    전체 비우기
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
              >
                닫기
              </button>
            </div>
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

      {/* Floating Animated Toast Notification */}
      {toast && (
        <div className="fixed top-6 inset-x-0 z-[9999] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto bg-slate-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center gap-3.5 max-w-md w-full animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-rose-400 flex items-center justify-center text-lg shadow-md shrink-0">
              🎉
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-white leading-tight">{toast.title}</h4>
              {toast.subtitle && (
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{toast.subtitle}</p>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white text-xs p-1 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
