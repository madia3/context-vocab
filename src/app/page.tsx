'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VocabItem, DictSearchResult } from '@/types/vocab';
import {
  fetchVocabulary,
  addVocabularyItem,
  deleteVocabularyItem,
  updateVocabularyContext,
  updateQuizStat,
  resetWithSamples,
  clearAllVocab,
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
} from '@/lib/ocr';
import {
  extractTextWithAI,
  findSentenceWithAI,
  getStoredGeminiKey,
  setStoredGeminiKey,
} from '@/lib/gemini';
import { fireConfetti } from '@/lib/confetti';
import { isSupabaseConfigured } from '@/lib/supabase';
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
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'add' | 'list' | 'quiz'>('add');
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Add Word Form State
  const [inputWord, setInputWord] = useState('');
  const [inputContext, setInputContext] = useState('');
  const [inputSource, setInputSource] = useState('');
  const [inputBookTitle, setInputBookTitle] = useState('햄릿 (Hamlet)');
  const [isCustomBook, setIsCustomBook] = useState(false);
  const [customBookInput, setCustomBookInput] = useState('');
  const [isSearchingDict, setIsSearchingDict] = useState(false);
  const [dictResult, setDictResult] = useState<DictSearchResult | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState('');
  const [selectedPos, setSelectedPos] = useState('');
  const [customMeaning, setCustomMeaning] = useState('');
  const inputWordRef = useRef<HTMLInputElement>(null);

  // OCR & Web Source State (현재 로드된 페이지/웹문서 텍스트 & 캐시)
  const [pageOcrText, setPageOcrText] = useState<string>('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrDetectedNotice, setOcrDetectedNotice] = useState<string | null>(null);
  const [detectedCandidateSentences, setDetectedCandidateSentences] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Background Non-blocking Processing State (백그라운드 분석 및 저장 대기)
  const [isSourceProcessing, setIsSourceProcessing] = useState(false);
  const [sourceProcessTaskName, setSourceProcessTaskName] = useState<string>('');
  const [isSavingAwaitingSource, setIsSavingAwaitingSource] = useState(false);
  const sourceTaskPromiseRef = useRef<Promise<string | null> | null>(null);

  // Web URL Scraper State (웹페이지 URL에서 문장 가져오기)
  const [inputWebUrl, setInputWebUrl] = useState<string>('');
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [isUrlScraping, setIsUrlScraping] = useState(false);
  const [urlScrapeError, setUrlScrapeError] = useState<string | null>(null);
  const [loadedSourceType, setLoadedSourceType] = useState<'camera' | 'web' | null>(null);
  const [loadedWebTitle, setLoadedWebTitle] = useState<string>('');

  // Filter & Grouping State
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');

  // Live Dictionary Candidates State (아래쪽 결과 영역 리스트용)
  const [liveCandidates, setLiveCandidates] = useState<SuggestionItem[]>([]);

  // Quiz State
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

  // Load Data on Mount
  useEffect(() => {
    loadData();
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

  // Live Dictionary candidate update on typing (0ms 로컬 + 비동기 글로벌 확장)
  useEffect(() => {
    if (!inputWord.trim()) {
      setLiveCandidates([]);
      return;
    }
    // 1) 0ms 즉각 로컬 사전 매칭
    const local = getLiveDictCandidates(inputWord);
    setLiveCandidates(local);

    // 2) 10만 단어 어휘 비동기 보완
    let isCurrent = true;
    fetchLiveDictSuggestions(inputWord).then((candidates) => {
      if (isCurrent && candidates.length > 0) {
        setLiveCandidates(candidates);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [inputWord]);

  async function loadData() {
    const list = await fetchVocabulary();
    setVocabulary(list);
    setIsLoaded(true);
  }

  // 원문 소스(사진 또는 웹 URL) 백그라운드 비동기 처리 함수
  function startBackgroundSourceAnalysis(
    taskName: string,
    sourceType: 'camera' | 'web',
    processFn: () => Promise<{ text: string; title?: string; sourceUrl?: string; sentenceCount?: number }>
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
          setInputSource(result.sourceUrl);
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('context_vocab_cached_page_ocr', result.text);
        }

        // 백그라운드 분석이 끝났을 때 사용자가 이미 입력해 둔 단어가 있거나 사전 결과가 있다면 즉시 문장 자동 매칭!
        const currentWord = (inputWord || dictResult?.word || '').trim();
        if (currentWord) {
          const matchRes = await findSentenceWithAI(result.text, currentWord, geminiApiKey);
          if (matchRes.found && matchRes.sentence) {
            const sentences = matchRes.allMatches.map((m) => m.sentence);
            setDetectedCandidateSentences(sentences);
            setInputContext(matchRes.sentence);
            if (sentences.length > 1) {
              setOcrDetectedNotice(`✨ 분석 완료! 본문 내에서 '${currentWord}'가 ${sentences.length}번 쓰였습니다.`);
            } else {
              setOcrDetectedNotice(`✨ 백그라운드 분석 완료! 원문 속 문장을 자동으로 연결했습니다.`);
            }
          }
        }

        triggerToast(
          `${taskName} 완료! ✅`,
          sourceType === 'web'
            ? `"${result.title || '웹 기사'}" 본문 문장들이 준비되었습니다. 이제 단어를 등록해 보세요!`
            : `책 페이지 글자 인식이 완료되어 원문 문장이 준비되었습니다.`
        );

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

  // OCR 페이지 사진 촬영 / 업로드 핸들러 (백그라운드 비동기 처리 - 블로킹 없음)
  async function handlePagePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsOcrProcessing(true);
    setOcrProgress(30);

    triggerToast('사진 분석 시작! 📸', '백그라운드에서 글자를 읽는 동안 단어를 먼저 입력하고 뜻을 고르세요.');

    startBackgroundSourceAnalysis('책 사진 분석', 'camera', async () => {
      setOcrProgress(60);
      const { text: extractedText } = await extractTextWithAI(file, geminiApiKey);
      setOcrProgress(100);
      return { text: extractedText };
    });
  }

  // Handle Web Page URL Scraping (백그라운드 비동기 처리 - 블로킹 없음)
  async function handleScrapeUrl() {
    const targetUrl = inputWebUrl.trim();
    if (!targetUrl) {
      setUrlScrapeError('웹페이지 주소(URL)를 입력해 주세요.');
      return;
    }

    setUrlScrapeError(null);
    setIsUrlModalOpen(false); // 모달 즉시 닫고 사용자가 바로 다른 작업 하도록 허용!
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

  // Handle Dictionary Search with target word
  async function executeSearch(targetWord?: string) {
    const wordToSearch = (targetWord || inputWord).trim();
    if (!wordToSearch) {
      alert('조회할 영어 단어를 입력해 주세요!');
      return;
    }

    // 만약 현재 촬영해둔 페이지 텍스트가 있다면, AI를 통해 복수/단수/시제 변화형을 문맥에서 스마트 탐색!
    if (pageOcrText) {
      findSentenceWithAI(pageOcrText, wordToSearch, geminiApiKey).then((matchRes) => {
        if (matchRes.found && matchRes.sentence) {
          const sentences = matchRes.allMatches.map((m) => m.sentence);
          setDetectedCandidateSentences(sentences);
          setInputContext(matchRes.sentence);
          if (sentences.length > 1) {
            setOcrDetectedNotice(`✨ 페이지 내에서 이 단어가 ${sentences.length}번 쓰였습니다! 아래에서 대표 문맥을 선택하세요.`);
          } else {
            const notice = matchRes.matchedWord && matchRes.matchedWord.toLowerCase() !== wordToSearch.toLowerCase()
              ? `🤖 AI가 형태소 변화형("${matchRes.matchedWord}")을 감지하여 원문 문장을 자동 선택했습니다!`
              : `📸 촬영한 페이지에서 원문 문장을 자동으로 찾았습니다!`;
            setOcrDetectedNotice(notice);
          }
        } else {
          setDetectedCandidateSentences([]);
        }
      });
    }

    setIsSearchingDict(true);
    try {
      const res = await lookupDictionary(wordToSearch);
      setDictResult(res);
      if (res.meanings.length > 0) {
        setSelectedMeaning(res.meanings[0].def);
        setSelectedPos(res.meanings[0].pos);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingDict(false);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      executeSearch();
    }
  }

  function handleSelectCandidate(word: string) {
    setInputWord(word);
    executeSearch(word);
  }

  // Save to Vocabulary
  async function handleSaveWord() {
    if (!dictResult || !selectedMeaning) return;

    // 만약 사용자가 저장을 눌렀는데 원문 분석이 아직 백그라운드에서 진행 중이고 문장이 비어있다면:
    // 백그라운드 분석이 완료될 때까지 잠시 대기했다가 자동으로 문맥 문장을 찾아 함께 저장!
    let matchedContext = inputContext.trim();
    let candidatesList = detectedCandidateSentences;

    if (!matchedContext && isSourceProcessing && sourceTaskPromiseRef.current) {
      setIsSavingAwaitingSource(true);
      try {
        const sourceText = await Promise.race([
          sourceTaskPromiseRef.current,
          new Promise<null>((res) => setTimeout(() => res(null), 6000)),
        ]);

        if (sourceText) {
          const matchRes = await findSentenceWithAI(sourceText, dictResult.word, geminiApiKey);
          if (matchRes.found && matchRes.sentence) {
            matchedContext = matchRes.sentence;
            candidatesList = matchRes.allMatches.map((m) => m.sentence);
          }
        }
      } catch (err) {
        console.warn('Awaiting source analysis error:', err);
      } finally {
        setIsSavingAwaitingSource(false);
      }
    }

    const bookToSave = inputBookTitle.trim() || '기본 단어장';
    const finalContext =
      matchedContext || `This sentence illustrates the word ${dictResult.word}.`;
    const finalCandidates =
      candidatesList.length > 0
        ? Array.from(new Set([finalContext, ...candidatesList]))
        : [finalContext];

    const newItem: VocabItem = {
      id: 'vocab_' + Date.now(),
      word: dictResult.word,
      phonetic: dictResult.phonetic,
      partOfSpeech: selectedPos || '단어',
      selectedMeaning: selectedMeaning,
      allMeanings: dictResult.meanings.map((m) => m.def),
      contextSentence: finalContext,
      candidateSentences: finalCandidates,
      sourceMemo: inputSource.trim() || '원서 메모',
      bookTitle: bookToSave,
      quizCount: 0,
      correctCount: 0,
      date: new Date().toISOString().slice(0, 10),
    };

    await addVocabularyItem(newItem);
    await loadData();

    // 바로 다음 단어 등록 시 이전 단어장(책이름) 기억!
    if (typeof window !== 'undefined') {
      localStorage.setItem('context_vocab_last_book_title', bookToSave);
    }

    // Reset Form for next word entry (단어장은 그대로 유지!)
    setInputWord('');
    setInputContext('');
    setInputSource('');
    setDictResult(null);
    setSelectedMeaning('');
    setSelectedPos('');
    setCustomMeaning('');
    setIsCustomBook(false);
    setCustomBookInput('');
    setDetectedCandidateSentences([]);
    setOcrDetectedNotice(null);

    // 팡! 터지는 화려한 폭죽 효과
    fireConfetti({ particleCount: 80, spread: 70, origin: { x: 0.35, y: 0.55 } });
    setTimeout(() => {
      fireConfetti({ particleCount: 80, spread: 70, origin: { x: 0.65, y: 0.55 } });
    }, 200);

    triggerToast(`'${newItem.word}' 저장 완료! 🎉`, `[${bookToSave}] 단어장에 추가되었습니다. 다음 단어를 바로 등록해 보세요!`);
    
    // 다음 단어를 바로 입력할 수 있도록 입력창에 포커스
    setTimeout(() => {
      inputWordRef.current?.focus();
    }, 100);
  }

  // Delete Item
  async function handleDeleteWord(id: string) {
    if (!confirm('이 단어를 단어장에서 삭제할까요?')) return;
    await deleteVocabularyItem(id);
    await loadData();
  }

  // Quiz Logic
  function startQuiz(targetBook?: string) {
    const bookFilter = targetBook || selectedBookFilter;
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

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setQuizList(shuffled);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setIsQuizFinished(false);
    setActiveTab('quiz');
    setupQuestion(0, shuffled);
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

    // 퀴즈 통계 자동 업데이트 (푼 횟수 + 맞춘 횟수)
    await updateQuizStat(current.id, isCorrect);
    // 로컬 목록 통계 갱신
    setVocabulary((prev) =>
      prev.map((v) =>
        v.id === current.id
          ? {
              ...v,
              quizCount: (v.quizCount || 0) + 1,
              correctCount: (v.correctCount || 0) + (isCorrect ? 1 : 0),
            }
          : v
      )
    );

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      fireConfetti({ particleCount: 50, spread: 60, origin: { x: 0.5, y: 0.6 } });

      // 정답 선택 즉시 지연 없이 원문 문장 원어민 고음질 낭독 시작
      const textToRead = current.contextSentence?.trim() || current.word;
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
    setInputWord(w);
    setInputContext(c);
    setInputSource(s);
    setInputBookTitle(b);
    executeSearch(w);
  }

  // Available unique book titles
  const availableBookTitles = Array.from(
    new Set(vocabulary.map((v) => v.bookTitle || '기본 단어장').filter(Boolean))
  );

  // Filtered vocabulary list
  const filteredVocabulary =
    selectedBookFilter === 'all'
      ? vocabulary
      : vocabulary.filter((v) => (v.bookTitle || '기본 단어장') === selectedBookFilter);

  const currentQuizItem = quizList[currentQuizIndex];

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-indigo-100">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-slate-900 leading-tight">ContextVocab</h1>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
                  Next.js + Supabase
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">원서·레포트 영한 단어장 & 5지선다 퀴즈</p>
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('add')}
                className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1 ${
                  activeTab === 'add'
                    ? 'bg-white text-indigo-600 font-bold shadow-sm'
                    : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>단어 등록</span>
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'list'
                    ? 'bg-white text-indigo-600 font-bold shadow-sm'
                    : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>단어장</span>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {vocabulary.length}
                </span>
              </button>
              <button
                onClick={() => startQuiz()}
                className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1 ${
                  activeTab === 'quiz'
                    ? 'bg-white text-indigo-600 font-bold shadow-sm'
                    : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>5지선다 🎯</span>
              </button>
            </nav>

            {/* AI Status / Connect Button */}
            {geminiApiKey ? (
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1 font-bold transition cursor-pointer"
                title="Google Gemini AI 비전 & 문맥 분석 활성화됨"
              >
                <Bot className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">AI 활성중</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2.5 py-1.5 rounded-xl flex items-center gap-1 font-bold shadow-xs hover:opacity-95 transition cursor-pointer"
                title="Google Gemini AI 무료 연동"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 연동하기</span>
              </button>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="설정 및 Supabase 안내"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-4 py-5 flex-1">
        {/* Status Banner */}
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              <strong>⚡ 책별 단어장 & 퀴즈 성적 추적</strong>: 단어장별 분류 + 문제 푼 횟수/정답률 실시간 기록
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                isSupabaseConfigured
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              <Database className="w-3 h-3" />
              {isSupabaseConfigured ? 'Supabase 클라우드 동기화' : '로컬 모드 (Supabase 대기)'}
            </span>
            <span className="text-emerald-700 font-semibold hidden sm:inline">TTS 음성 무료</span>
          </div>
        </div>

        {/* ========================================= */}
        {/* TAB 1: ADD WORD & CONTEXT */}
        {/* ========================================= */}
        {activeTab === 'add' && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>모르는 단어와 원문 문장 입력하기</span>
              </h2>
              <p className="text-xs text-slate-500">
                원서나 논문에서 읽던 문맥 그대로 입력하면, 퀴즈를 풀 때 그 문장과 원어민 발음이 함께 복습됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Form with Autocomplete and Book Title */}
              <div className="space-y-4">
                {/* Book Title Selection / Input */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <BookMarked className="w-3.5 h-3.5 text-indigo-600" />
                      <span>저장할 단어장 선택 <span className="text-rose-500">*</span></span>
                    </label>
                    <span className="text-[10px] text-indigo-600 font-semibold">이전 단어장 자동 선택됨</span>
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

                  {/* Previous Book Title Chips */}
                  {availableBookTitles.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">빠른 선택:</span>
                      {availableBookTitles.map((title) => (
                        <button
                          key={title}
                          type="button"
                          onClick={() => {
                            setIsCustomBook(false);
                            setInputBookTitle(title);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                            !isCustomBook && inputBookTitle === title
                              ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {title}
                        </button>
                      ))}
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
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3.5 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>원문 문장 불러오기 (책 사진 촬영 또는 웹페이지 URL)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {geminiApiKey ? (
                        <button
                          type="button"
                          onClick={() => setIsAiModalOpen(true)}
                          className="text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 transition cursor-pointer"
                        >
                          <Bot className="w-3 h-3 text-purple-600" /> AI 연동됨
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAiModalOpen(true)}
                          className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 transition cursor-pointer shadow-xs"
                        >
                          <Sparkles className="w-3 h-3 text-white" /> AI 연동하기
                        </button>
                      )}
                      {pageOcrText && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {loadedSourceType === 'web' ? '웹페이지 로드됨' : '페이지 인식됨'}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSourceProcessing ? (
                    <div className="py-2 px-3 bg-white/80 rounded-xl border border-indigo-200 shadow-xs space-y-1.5 animate-pulse">
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-800">
                        <span className="flex items-center gap-1.5">
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>백그라운드에서 {sourceProcessTaskName || '원문 텍스트'} 분석 중...</span>
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">비동기 처리중</span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">
                        ✨ <strong>기다릴 필요 없습니다!</strong> 아래에서 영어 단어를 입력하고 뜻을 고르고 계시면, 분석이 끝나는 즉시 문장을 자동으로 찾아 연결해 드립니다.
                      </p>
                    </div>
                  ) : pageOcrText ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900">
                        {loadedSourceType === 'web' ? (
                          <>
                            <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">웹페이지: {loadedWebTitle || '웹 기사'}</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>촬영한 책 페이지</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-indigo-900/80 line-clamp-2 italic bg-white/70 p-2 rounded-lg border border-indigo-100">
                        &quot;{pageOcrText.slice(0, 140)}...&quot;
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          💡 단어를 입력하면 본문 속 원문 문장이 자동으로 매칭됩니다!
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5"
                          >
                            <Camera className="w-3 h-3" />
                            <span>새 사진</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsUrlModalOpen(true)}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5"
                          >
                            <Globe className="w-3 h-3" />
                            <span>새 URL</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPageOcrText('');
                              setLoadedSourceType(null);
                              setLoadedWebTitle('');
                              if (typeof window !== 'undefined') localStorage.removeItem('context_vocab_cached_page_ocr');
                            }}
                            className="text-[11px] text-slate-400 hover:text-rose-500"
                          >
                            지우기
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">
                        책 사진을 찍거나 웹페이지 주소를 넣으면 본문 문장들이 단어장에 자동으로 연동됩니다.
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          <span>책 사진 찍기</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsUrlModalOpen(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5"
                        >
                          <Globe className="w-3.5 h-3.5 text-white" />
                          <span>웹 URL 넣기</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Word Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      영어 단어 <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      타이핑 시 우측에 실시간 뜻 리스트 표시
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      ref={inputWordRef}
                      type="text"
                      value={inputWord}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInputWord(val);
                        setDictResult(null); // 타이핑 시 이전 상세 결과 닫고 실시간 리스트 표시

                        // 타이핑 도중에도 현재 페이지 텍스트에서 단어 문장 자동 탐색 (복수형, 시제 변화형 스마트 매칭)
                        if (pageOcrText && val.trim().length >= 3) {
                          const matches = findAllSentencesWithWordSmart(pageOcrText, val.trim());
                          if (matches.length > 0 && !inputContext) {
                            const sentences = matches.map((m) => m.sentence);
                            setDetectedCandidateSentences(sentences);
                            setInputContext(matches[0].sentence);
                            if (sentences.length > 1) {
                              setOcrDetectedNotice(`✨ 페이지 내에서 이 단어가 ${sentences.length}번 쓰였습니다! 아래에서 대표 문맥을 선택하세요.`);
                            } else {
                              const notice = matches[0].matchedWord.toLowerCase() !== val.trim().toLowerCase()
                                ? `💡 변화형("${matches[0].matchedWord}")이 포함된 원문 문장을 자동으로 찾았습니다!`
                                : '📸 촬영한 페이지에서 원문 문장을 자동으로 찾았습니다!';
                              setOcrDetectedNotice(notice);
                            }
                          }
                        }
                      }}
                      onKeyDown={handleInputKeyDown}
                      placeholder="단어를 입력하세요 (예: tra, prev, miti)"
                      className="flex-1 px-3.5 py-2.5 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                    <button
                      onClick={() => executeSearch()}
                      disabled={isSearchingDict}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isSearchingDict ? '조회중...' : '영한 사전 조회'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      원서 / 레포트 원문 문장 <span className="text-slate-400 font-normal">(권장)</span>
                    </label>
                    {ocrDetectedNotice && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded animate-fade-in">
                        {ocrDetectedNotice}
                      </span>
                    )}
                  </div>

                  {/* 페이지 내 복수 문장 발견 시 대표 문맥 선택 리스트 */}
                  {detectedCandidateSentences.length > 1 && (
                    <div className="bg-gradient-to-r from-indigo-50/90 to-purple-50/90 p-3 rounded-xl border border-indigo-200 space-y-2 mb-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>페이지 내 {detectedCandidateSentences.length}개 문장 발견 (대표 문맥 선택)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">선택 안 된 문장도 함께 자동 보관</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {detectedCandidateSentences.map((sent, sIdx) => {
                          const isChosen = inputContext.trim() === sent.trim();
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => setInputContext(sent)}
                              className={`w-full text-left p-2.5 rounded-lg border text-xs transition flex items-start gap-2.5 cursor-pointer ${
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
                              <span className="flex-1 font-serif leading-relaxed line-clamp-3">
                                &quot;{sent}&quot;
                              </span>
                              {isChosen && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold shrink-0">
                                  선택됨 ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <textarea
                    rows={3}
                    value={inputContext}
                    onChange={(e) => {
                      setInputContext(e.target.value);
                      setOcrDetectedNotice(null);
                    }}
                    placeholder="예: It was an unspeakable tragedy that shook the entire nation. (페이지 사진을 찍으면 자동 입력됩니다)"
                    className="w-full px-3.5 py-2.5 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    ※ 퀴즈 정답 시 이 문맥 속 단어가 형광펜으로 강조되며, 원어민 음성(TTS)으로 읽어줍니다.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    상세 메모 / 페이지 <span className="text-slate-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={inputSource}
                    onChange={(e) => setInputSource(e.target.value)}
                    placeholder="예: 3막 1장 45페이지, 서론 2문단"
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Right Column: Dictionary Result */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                    <h3 className="text-xs font-bold text-slate-700">
                      영한 사전 검색 결과 <span className="font-normal text-slate-500">(한국어 뜻 선택)</span>
                    </h3>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">
                      {dictResult
                        ? dictResult.sourceName
                        : liveCandidates.length > 0
                        ? `연관 추천 (${liveCandidates.length})`
                        : '대기중'}
                    </span>
                  </div>

                  {!dictResult && !isSearchingDict && (
                    <>
                      {liveCandidates.length > 0 ? (
                        <div className="space-y-2 w-full">
                          <div className="flex items-center justify-between pb-1 text-[11px] font-bold text-indigo-700">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>타이핑 연관 단어 & 한국어 뜻</span>
                            </span>
                            <span className="text-[10px] text-slate-400">클릭하여 선택</span>
                          </div>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {liveCandidates.map((c) => (
                              <button
                                key={c.word}
                                type="button"
                                onClick={() => handleSelectCandidate(c.word)}
                                className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/50 transition flex items-center justify-between shadow-xs group cursor-pointer"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-black text-slate-900 group-hover:text-indigo-600 text-xs">
                                    {c.word}
                                  </span>
                                  {c.pos && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                      {c.pos}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-600 font-medium truncate">
                                    {c.quickMeaning}
                                  </span>
                                </div>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                                  선택 ↵
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="py-10 text-center text-slate-400">
                          <p className="text-3xl mb-2">🇰🇷 📚</p>
                          <p className="text-xs font-medium text-slate-500">
                            단어를 입력하면 연관 한국어 뜻 리스트가 여기에 바로 뜹니다.
                          </p>
                          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                            <span className="text-[10px] text-slate-400">테스트용 추천:</span>
                            <button
                              onClick={() =>
                                fillSample(
                                  'tragedy',
                                  'It was a terrible tragedy that affected many innocent lives.',
                                  '3막 2장',
                                  '셰익스피어 햄릿'
                                )
                              }
                              className="text-[10px] bg-white border border-slate-300 hover:border-indigo-400 px-2 py-0.5 rounded text-indigo-600 font-medium"
                            >
                              tragedy
                            </button>
                            <button
                              onClick={() =>
                                fillSample(
                                  'prevalent',
                                  'The disease is significantly more prevalent in warm climates.',
                                  '12페이지',
                                  '의학 저널'
                                )
                              }
                              className="text-[10px] bg-white border border-slate-300 hover:border-indigo-400 px-2 py-0.5 rounded text-indigo-600 font-medium"
                            >
                              prevalent
                            </button>
                            <button
                              onClick={() =>
                                fillSample(
                                  'mitigate',
                                  'New technologies will help mitigate environmental degradation.',
                                  '결론부',
                                  '기후변화 보고서'
                                )
                              }
                              className="text-[10px] bg-white border border-slate-300 hover:border-indigo-400 px-2 py-0.5 rounded text-indigo-600 font-medium"
                            >
                              mitigate
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {isSearchingDict && (
                    <div className="py-10 text-center text-indigo-600">
                      <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-indigo-600 border-t-transparent mb-2"></div>
                      <p className="text-xs font-semibold">영한 사전 데이터를 가져오는 중입니다...</p>
                    </div>
                  )}

                  {dictResult && !isSearchingDict && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg text-slate-900">{dictResult.word}</span>
                          <span className="text-xs text-indigo-600 font-mono">{dictResult.phonetic}</span>
                        </div>
                        <button
                          onClick={() => speakWordTTS(dictResult.word, ttsVoice)}
                          className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold transition"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>발음 듣기</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-500 font-medium">
                        💡 원문 문맥에 가장 어울리는 한국어 뜻을 골라주세요:
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {dictResult.meanings.map((m, idx) => (
                          <label
                            key={idx}
                            onClick={() => {
                              setSelectedMeaning(m.def);
                              setSelectedPos(m.pos);
                            }}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition text-xs shadow-sm ${
                              selectedMeaning === m.def
                                ? 'border-indigo-600 bg-indigo-50/60 font-bold'
                                : 'border-slate-200 bg-white hover:border-indigo-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="meaningRadio"
                              checked={selectedMeaning === m.def}
                              onChange={() => {
                                setSelectedMeaning(m.def);
                                setSelectedPos(m.pos);
                              }}
                              className="mt-0.5 accent-indigo-600"
                            />
                            <div className="flex-1">
                              <span className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px] mr-1.5">
                                {m.pos}
                              </span>
                              <span className="text-slate-900">{m.def}</span>
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* Custom Direct Meaning Input */}
                      <div className="pt-2">
                        <details className="text-xs text-slate-600 cursor-pointer">
                          <summary className="font-semibold text-indigo-600 hover:underline">
                            원하는 뜻이 목록에 없나요? 직접 입력하기
                          </summary>
                          <div className="mt-2 flex gap-1.5">
                            <input
                              type="text"
                              value={customMeaning}
                              onChange={(e) => setCustomMeaning(e.target.value)}
                              placeholder="직접 한국어 뜻 입력"
                              className="flex-1 px-2.5 py-1.5 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg"
                            />
                            <button
                              onClick={() => {
                                if (!customMeaning.trim()) return;
                                setSelectedMeaning(customMeaning.trim());
                                setSelectedPos('직접입력');
                              }}
                              className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg shrink-0"
                            >
                              적용
                            </button>
                          </div>
                        </details>
                      </div>

                      {/* 혹시 이 단어를 찾으셨나요? (연관 완성 단어 추천 섹션) */}
                      {(() => {
                        const related = liveCandidates.filter((c) => c.word.toLowerCase() !== dictResult.word.toLowerCase());
                        if (related.length === 0) return null;
                        return (
                          <div className="pt-3 mt-3 border-t border-slate-200 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>혹시 이 단어를 찾으셨나요? (연관 추천)</span>
                              </span>
                              <span className="text-[10px] text-slate-400">클릭하여 단어 변경</span>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {related.map((c) => (
                                <button
                                  key={c.word}
                                  type="button"
                                  onClick={() => handleSelectCandidate(c.word)}
                                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/50 transition flex items-center justify-between shadow-xs group cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-black text-slate-900 group-hover:text-indigo-600 text-xs">
                                      {c.word}
                                    </span>
                                    {c.pos && (
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                        {c.pos}
                                      </span>
                                    )}
                                    <span className="text-xs text-slate-600 font-medium truncate">
                                      {c.quickMeaning}
                                    </span>
                                  </div>
                                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                                    단어 변경 ↵
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Save Action Button */}
                <div className="pt-3 mt-3 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={handleSaveWord}
                    disabled={!dictResult || !selectedMeaning || isSavingAwaitingSource}
                    className={`w-full sm:w-auto font-bold px-6 py-2.5 text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 ${
                      isSavingAwaitingSource
                        ? 'bg-amber-600 text-white cursor-wait animate-pulse'
                        : dictResult && selectedMeaning
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isSavingAwaitingSource ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>원문 문장 분석 완료 대기 중...</span>
                      </>
                    ) : (
                      <span>⭐ [{inputBookTitle || '기본 단어장'}]에 저장하기</span>
                    )}
                  </button>
                </div>
              </div>
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
                    onChange={(e) => setSelectedBookFilter(e.target.value)}
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
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
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

                        {/* Context Sentence */}
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400">대표 원문:</span>
                            <button
                              onClick={() => speakSentenceTTS(item.contextSentence, ttsVoice)}
                              className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 font-bold"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>문장 전체 듣기</span>
                            </button>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-serif">
                            {renderHighlightedContext(item.contextSentence, item.word)}
                          </p>

                          {/* 해당 페이지의 다른 원문 문장 목록 (나중에 변경 가능) */}
                          {item.candidateSentences && item.candidateSentences.length > 1 && (
                            <details className="pt-2 border-t border-slate-200/80 text-xs text-slate-600 group">
                              <summary className="cursor-pointer font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px]">
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                <span>이 페이지의 다른 문맥 ({item.candidateSentences.length}개 보관됨)</span>
                              </summary>
                              <div className="mt-2 space-y-1.5 pl-1.5 border-l-2 border-indigo-200">
                                {item.candidateSentences.map((sent, sIdx) => {
                                  const isCurrent = item.contextSentence.trim() === sent.trim();
                                  return (
                                    <div
                                      key={sIdx}
                                      className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                        isCurrent
                                          ? 'bg-indigo-50/90 border-indigo-300 font-bold text-slate-900 shadow-xs'
                                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                      }`}
                                    >
                                      <p className="flex-1 font-serif text-[11px] leading-relaxed">
                                        &quot;{sent}&quot;
                                      </p>
                                      {isCurrent ? (
                                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold shrink-0 self-start sm:self-auto">
                                          현재 대표 ✓
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await updateVocabularyContext(item.id, sent);
                                            await loadData();
                                            triggerToast(
                                              '대표 원문 문장 변경 완료! 📖',
                                              `앞으로 퀴즈 복습 시 변경된 문장이 출제됩니다.`
                                            );
                                          }}
                                          className="text-[10px] bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2 py-0.5 rounded font-bold transition shrink-0 self-start sm:self-auto cursor-pointer"
                                        >
                                          이 문장으로 변경 ➔
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          )}
                        </div>
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
          <section className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
              {/* Quiz Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold">
                    5지선다 객관식
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
                      <div className="mb-2">
                        <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                          <BookMarked className="w-3 h-3" />
                          <span>{currentQuizItem.bookTitle || '단어장'}</span>
                        </span>
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
                        <div className="bg-amber-50/95 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                              📖 원서 / 레포트 속 실제 원문 문맥
                            </span>
                            <button
                              onClick={() => speakSentenceTTS(currentQuizItem.contextSentence, ttsVoice)}
                              className="text-xs bg-amber-200/90 hover:bg-amber-300 text-amber-900 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>원문 다시 듣기 (TTS)</span>
                            </button>
                          </div>
                          <p className="text-base text-slate-800 leading-relaxed font-serif pt-1">
                            {renderHighlightedContext(currentQuizItem.contextSentence, currentQuizItem.word)}
                          </p>
                          <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 text-xs text-slate-500">
                            <span>출처: {currentQuizItem.sourceMemo || '원서'}</span>
                            <button
                              onClick={() => speakWordTTS(currentQuizItem.word, ttsVoice)}
                              className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>단어만 다시 듣기</span>
                            </button>
                          </div>
                        </div>

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
                    <div className="pt-4 flex justify-center gap-2">
                      <button
                        onClick={() => startQuiz(selectedBookFilter)}
                        className="bg-indigo-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition"
                      >
                        다시 풀기 🔄
                      </button>
                      <button
                        onClick={() => setActiveTab('list')}
                        className="bg-slate-200 text-slate-800 font-bold text-xs px-5 py-2.5 rounded-xl transition"
                      >
                        단어장 확인하기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Web Page URL Scraper Modal */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    웹페이지 URL로 원문 가져오기
                  </h3>
                  <p className="text-[11px] text-indigo-600 font-semibold">
                    영문 기사나 웹페이지의 문장들을 단어장에 자동으로 연동합니다
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
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
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs"
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
                      className="text-[10px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition"
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
                <p className="font-bold text-slate-800">💡 이렇게 활용하세요:</p>
                <p>1. 읽고 계신 영문 뉴스 기사나 웹 칼럼의 주소를 붙여넣습니다.</p>
                <p>2. [문장 불러오기]를 누르면 기사 제목과 본문 문장들이 자동으로 준비됩니다.</p>
                <p>3. 단어를 검색하면 해당 기사에서 쓰인 실제 원문 문장을 AI가 쏙 찾아냅니다!</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                취소
              </button>
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
            </div>
          </div>
        </div>
      )}

      {/* Dedicated AI Setup Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-purple-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    Google Gemini AI 원클릭 연동
                  </h3>
                  <p className="text-[11px] text-purple-600 font-semibold">
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
            <div className="bg-purple-50/70 rounded-2xl p-4 border border-purple-100 space-y-2 text-xs text-purple-950">
              <h4 className="font-black text-xs text-purple-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>AI 연동 시 이런 점이 강력해집니다:</span>
              </h4>
              <ul className="space-y-1.5 text-[11px] text-purple-900/90 leading-relaxed pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-600 font-bold">1.</span>
                  <span><strong>사진 오타·줄바꿈 100% 자동 교정</strong>: 모바일 카메라로 대충 찍어도 흐릿한 글자, 잘린 하이픈(con- / dition)을 자연스러운 문장으로 복원합니다.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-600 font-bold">2.</span>
                  <span><strong>문맥 속 변화형 자동 감지</strong>: 단어를 원형(party, run)으로 입력해도 책 속의 복수형(parties), 과거형(ran), 분사형 등을 AI가 문맥에서 스스로 찾아냅니다.</span>
                </li>
              </ul>
            </div>

            {/* Step-by-Step API Key Entry */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Gemini API Key 등록 (신용카드 불필요 · 평생 무료)</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1"
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
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                />
                <button
                  type="button"
                  onClick={() => handleSaveAndTestAiKey()}
                  disabled={isTestingKey}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
              {/* Supabase Status Info */}
              <div
                className={`p-3 rounded-xl border ${
                  isSupabaseConfigured
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Database className="w-4 h-4" />
                  <span>
                    {isSupabaseConfigured
                      ? 'Supabase 연동 완료됨'
                      : 'Supabase 미연동 (로컬 스토리지 모드로 작동 중)'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {isSupabaseConfigured
                    ? '단어가 Supabase 클라우드 데이터베이스에 실시간 동기화됩니다.'
                    : '.env.local 파일에 NEXT_PUBLIC_SUPABASE_URL 및 NEXT_PUBLIC_SUPABASE_ANON_KEY를 입력하면 클라우드 동기화가 활성화됩니다.'}
                </p>
              </div>

              {/* Google Gemini AI Vision & Sentence Matcher Settings */}
              <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950 flex items-center gap-1.5 text-xs">
                    <Bot className="w-4 h-4 text-purple-600" />
                    <span>Google Gemini AI 비전 & 문맥 분석</span>
                  </span>
                  {geminiApiKey ? (
                    <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-full">
                      연동 활성화됨
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      미등록 (기본 모드)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-purple-900/80 leading-relaxed">
                  Gemini API를 연동하면 책 사진의 오타·잘린 줄바꿈을 완벽히 복원하고, 단어의 복수형(parties)/과거형(walked) 등 형태소 변화형까지 AI가 문맥에서 스스로 찾아냅니다.
                </p>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="password"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy... (Gemini API 키 입력)"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shrink-0 cursor-pointer"
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
                      className="bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 font-bold px-2.5 py-1.5 rounded-lg text-xs transition shrink-0 cursor-pointer"
                    >
                      해제
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between pt-0.5 text-[10px] text-purple-700">
                  <span>💡 개인용 무료 키 발급 (신용카드 불필요)</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline flex items-center gap-0.5 hover:text-purple-900"
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
