'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VocabItem, DictSearchResult } from '@/types/vocab';
import {
  fetchVocabulary,
  addVocabularyItem,
  deleteVocabularyItem,
  resetWithSamples,
  clearAllVocab,
} from '@/lib/vocabService';
import {
  lookupDictionary,
  speakWordTTS,
  speakSentenceTTS,
  DISTRACTOR_POOL_KOREAN,
} from '@/lib/dictionary';
import { getAutocompleteSuggestions } from '@/lib/autocomplete';
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
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'add' | 'list' | 'quiz'>('add');
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Add Word Form State
  const [inputWord, setInputWord] = useState('');
  const [inputContext, setInputContext] = useState('');
  const [inputSource, setInputSource] = useState('');
  const [isSearchingDict, setIsSearchingDict] = useState(false);
  const [dictResult, setDictResult] = useState<DictSearchResult | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState('');
  const [selectedPos, setSelectedPos] = useState('');
  const [customMeaning, setCustomMeaning] = useState('');
  const inputWordRef = useRef<HTMLInputElement>(null);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const autocompleteRef = useRef<HTMLDivElement>(null);

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
  const [ttsVoice, setTtsVoice] = useState('en-US');

  // Floating Toast State
  const [toast, setToast] = useState<{ show: boolean; title: string; subtitle?: string } | null>(null);

  function triggerToast(title: string, subtitle?: string) {
    setToast({ show: true, title, subtitle });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  // Load Data on Mount
  useEffect(() => {
    loadData();
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('context_vocab_tts_voice');
      if (savedVoice) setTtsVoice(savedVoice);
    }
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplete debounce effect
  useEffect(() => {
    if (!inputWord.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await getAutocompleteSuggestions(inputWord);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setHighlightedIndex(-1);
    }, 120);

    return () => clearTimeout(timer);
  }, [inputWord]);

  async function loadData() {
    const list = await fetchVocabulary();
    setVocabulary(list);
    setIsLoaded(true);
  }

  // Handle Dictionary Search with target word
  async function executeSearch(targetWord?: string) {
    const wordToSearch = (targetWord || inputWord).trim();
    if (!wordToSearch) {
      alert('조회할 영어 단어를 입력해 주세요!');
      return;
    }
    setShowSuggestions(false);
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

  // Handle Input Keydown for Autocomplete navigation
  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          const selected = suggestions[highlightedIndex];
          setInputWord(selected);
          executeSearch(selected);
        } else {
          executeSearch();
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      executeSearch();
    }
  }

  function handleSelectSuggestion(word: string) {
    setInputWord(word);
    setShowSuggestions(false);
    executeSearch(word);
  }

  // Save to Vocabulary
  async function handleSaveWord() {
    if (!dictResult || !selectedMeaning) return;

    const newItem: VocabItem = {
      id: 'vocab_' + Date.now(),
      word: dictResult.word,
      phonetic: dictResult.phonetic,
      partOfSpeech: selectedPos || '단어',
      selectedMeaning: selectedMeaning,
      allMeanings: dictResult.meanings.map((m) => m.def),
      contextSentence:
        inputContext.trim() || `This sentence illustrates the word ${dictResult.word}.`,
      sourceMemo: inputSource.trim() || '원서 메모',
      date: new Date().toISOString().slice(0, 10),
    };

    await addVocabularyItem(newItem);
    await loadData();

    // Reset Form for next word entry
    setInputWord('');
    setInputContext('');
    setInputSource('');
    setDictResult(null);
    setSelectedMeaning('');
    setSelectedPos('');
    setCustomMeaning('');

    // 팡! 터지는 화려한 폭죽 효과
    fireConfetti({ particleCount: 80, spread: 70, origin: { x: 0.35, y: 0.55 } });
    setTimeout(() => {
      fireConfetti({ particleCount: 80, spread: 70, origin: { x: 0.65, y: 0.55 } });
    }, 200);

    triggerToast(`'${newItem.word}' 저장 완료! 🎉`, `단어장에 추가되었습니다. 다음 단어를 바로 등록해 보세요!`);
    
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
  function startQuiz() {
    if (vocabulary.length === 0) {
      alert('퀴즈를 풀기 전에 먼저 단어를 등록해 주세요!');
      setActiveTab('add');
      return;
    }
    const shuffled = [...vocabulary].sort(() => 0.5 - Math.random());
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

    // Options: 1 correct + 4 distractors
    const correct = current.selectedMeaning;
    const opts = [correct];

    // Other vocab items
    const otherVocab = vocabulary
      .filter((v) => v.word !== current.word)
      .map((v) => v.selectedMeaning);
    const shuffledOthers = [...otherVocab].sort(() => 0.5 - Math.random());

    for (const m of shuffledOthers) {
      if (!opts.includes(m) && opts.length < 5) opts.push(m);
    }

    // Distractor pool
    const shuffledDistractors = [...DISTRACTOR_POOL_KOREAN].sort(() => 0.5 - Math.random());
    for (const d of shuffledDistractors) {
      if (!opts.includes(d) && opts.length < 5) opts.push(d);
    }

    setQuizOptions(opts.sort(() => 0.5 - Math.random()));
  }

  function handleSelectOption(chosen: string) {
    if (quizAnswerState.answered) return;
    const current = quizList[currentQuizIndex];
    const isCorrect = chosen === current.selectedMeaning;

    setQuizAnswerState({ answered: true, chosen, isCorrect });

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
  function fillSample(w: string, c: string, s: string) {
    setInputWord(w);
    setInputContext(c);
    setInputSource(s);
    executeSearch(w);
  }

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
                onClick={startQuiz}
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

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
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
              <strong>⚡ 실시간 자동완성 & 정밀 사전</strong>: 타이핑 시 예상 단어 추천 + 품사별 뜻 즉시 제공
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
              {/* Left Column: Form with Autocomplete */}
              <div className="space-y-4">
                <div className="relative" ref={autocompleteRef}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      영어 단어 <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-indigo-600 font-medium">
                      💡 방향키(↑↓)로 선택 후 Enter
                    </span>
                  </div>

                  <div className="flex gap-2 relative">
                    <input
                      ref={inputWordRef}
                      type="text"
                      value={inputWord}
                      onChange={(e) => setInputWord(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onFocus={() => {
                        if (suggestions.length > 0) setShowSuggestions(true);
                      }}
                      placeholder="단어 앞 글자를 치면 자동완성됩니다 (예: trag, prev, miti)"
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

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                      <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                        <span>추천 단어 목록 ({suggestions.length})</span>
                        <span>방향키로 이동</span>
                      </div>
                      {suggestions.map((item, idx) => (
                        <div
                          key={item}
                          onClick={() => handleSelectSuggestion(item)}
                          className={`px-3.5 py-2.5 text-xs cursor-pointer flex items-center justify-between transition ${
                            highlightedIndex === idx
                              ? 'bg-indigo-50 text-indigo-900 font-bold'
                              : 'text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Search className="w-3 h-3 text-slate-400" />
                            <span className="font-semibold">{item}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">선택 ↵</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    원서 / 레포트 원문 문장 <span className="text-slate-400 font-normal">(권장)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={inputContext}
                    onChange={(e) => setInputContext(e.target.value)}
                    placeholder="예: It was an unspeakable tragedy that shook the entire nation."
                    className="w-full px-3.5 py-2.5 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    ※ 퀴즈 정답 시 이 문맥 속 단어가 형광펜으로 강조되며, 원어민 음성(TTS)으로 읽어줍니다.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    출처 메모 <span className="text-slate-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={inputSource}
                    onChange={(e) => setInputSource(e.target.value)}
                    placeholder="예: 햄릿 3막, 타임지 기사, 기후변화 리포트"
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
                      {dictResult ? dictResult.sourceName : '대기중'}
                    </span>
                  </div>

                  {!dictResult && !isSearchingDict && (
                    <div className="py-10 text-center text-slate-400">
                      <p className="text-3xl mb-2">🇰🇷 📚</p>
                      <p className="text-xs font-medium text-slate-500">
                        단어를 입력하고 [영한 사전 조회]를 눌러주세요.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                        <span className="text-[10px] text-slate-400">테스트용 추천:</span>
                        <button
                          onClick={() =>
                            fillSample(
                              'tragedy',
                              'It was a terrible tragedy that affected many innocent lives.',
                              '셰익스피어 원서'
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
                              '의학 저널 12p'
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
                    </div>
                  )}
                </div>

                {/* Save Action Button */}
                <div className="pt-3 mt-3 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={handleSaveWord}
                    disabled={!dictResult || !selectedMeaning}
                    className={`w-full sm:w-auto font-bold px-6 py-2.5 text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 ${
                      dictResult && selectedMeaning
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>⭐ 단어장에 선택한 뜻 저장하기</span>
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">내 문맥 영한 단어장</h2>
                <p className="text-xs text-slate-500">원서에서 직접 수집한 단어와 한국어 뜻 목록입니다.</p>
              </div>
              <button
                onClick={startQuiz}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>5지선다 퀴즈 풀기</span>
              </button>
            </div>

            {vocabulary.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-4xl mb-3">📭</p>
                <h3 className="text-sm font-bold text-slate-700 mb-1">저장된 단어가 아직 없습니다.</h3>
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
                {vocabulary.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
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
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400">원서 원문:</span>
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
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>출처: {item.sourceMemo || '원서'}</span>
                      <span>{item.date}</span>
                    </div>
                  </div>
                ))}
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
                      <div className="mt-5 space-y-4 animate-toast">
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
                        onClick={startQuiz}
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

      {/* Settings Modal */}
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-toast">
          <div className="bg-slate-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center gap-3.5 max-w-md min-w-[300px]">
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
