import { VocabItem } from '@/types/vocab';
import { supabase, checkIsSupabaseConfigured, getCurrentUser } from './supabase';
import { User } from '@supabase/supabase-js';

export const INITIAL_SAMPLES: VocabItem[] = [
  {
    id: "sample_tragedy",
    word: "tragedy",
    phonetic: "/ˈtrædʒ.ə.di/",
    partOfSpeech: "명사",
    selectedMeaning: "비극, 비극적인 사건이나 참사",
    allMeanings: ["비극, 참사", "비극적 사건", "비극 작품"],
    contextSentence: "It was an unspeakable tragedy that shook the entire community and left everyone in deep grief.",
    sourceMemo: "셰익스피어 원서",
    bookTitle: "햄릿 (Hamlet)",
    quizCount: 3,
    correctCount: 3,
    wrongCount: 0,
    consecutiveCorrect: 3,
    lastQuizDate: "2026-11-15",
    date: "2026-11-15"
  },
  {
    id: "sample_prevalent",
    word: "prevalent",
    phonetic: "/ˈprev.əl.ənt/",
    partOfSpeech: "형용사",
    selectedMeaning: "널리 퍼진, 유행하는",
    allMeanings: ["널리 퍼진, 유행하는", "우세한, 지배적인"],
    contextSentence: "The respiratory disease is significantly more prevalent in cold and crowded urban areas.",
    sourceMemo: "의학 저널 12p",
    bookTitle: "의학 저널 (Medical Journal)",
    quizCount: 2,
    correctCount: 1,
    wrongCount: 1,
    consecutiveCorrect: 1,
    lastQuizDate: "2026-11-15",
    date: "2026-11-15"
  },
  {
    id: "sample_ubiquitous",
    word: "ubiquitous",
    phonetic: "/juːˈbɪk.wə.təs/",
    partOfSpeech: "형용사",
    selectedMeaning: "어디에나 존재하는, 아주 흔한",
    allMeanings: ["어디에나 존재하는, 아주 흔한", "도처에 나타나는"],
    contextSentence: "Smartphones have become truly ubiquitous in every aspect of modern communication.",
    sourceMemo: "IT 트렌드",
    bookTitle: "AI & 테크 리포트",
    quizCount: 4,
    correctCount: 4,
    wrongCount: 0,
    consecutiveCorrect: 4,
    lastQuizDate: "2026-11-15",
    date: "2026-11-15"
  },
  {
    id: "sample_mitigate",
    word: "mitigate",
    phonetic: "/ˈmɪt.ɪ.ɡeɪt/",
    partOfSpeech: "동사",
    selectedMeaning: "(고통, 피해, 위험 등을) 완화하다, 경감시키다",
    allMeanings: ["완화하다, 경감시키다", "누그러뜨리다"],
    contextSentence: "Governments must implement strict policies to mitigate the severe consequences of climate crisis.",
    sourceMemo: "기후 리포트 3장",
    bookTitle: "지구 온난화 특별 보고서",
    quizCount: 1,
    correctCount: 1,
    wrongCount: 0,
    consecutiveCorrect: 1,
    lastQuizDate: "2026-11-15",
    date: "2026-11-15"
  },
  {
    id: "sample_pragmatic",
    word: "pragmatic",
    phonetic: "/præɡˈmæt.ɪk/",
    partOfSpeech: "형용사",
    selectedMeaning: "실용적인, 실무적인",
    allMeanings: ["실용적인, 실무적인", "현실주의적인"],
    contextSentence: "Instead of debating theoretical models, the team adopted a pragmatic approach to launch the MVP quickly.",
    sourceMemo: "스타트업 경영학 원서",
    bookTitle: "린 스타트업 (Lean Startup)",
    quizCount: 2,
    correctCount: 2,
    wrongCount: 0,
    consecutiveCorrect: 2,
    lastQuizDate: "2026-11-15",
    date: "2026-11-15"
  }
];

const GUEST_STORAGE_KEY = 'context_vocab_data';

function getUserStorageKey(userId?: string): string {
  return userId ? `context_vocab_user_${userId}` : GUEST_STORAGE_KEY;
}

/**
 * 단어 목록을 가져옵니다.
 * - 로그인된 유저가 있으면: Supabase에서 user_id로 격리된 단어를 가져오며, 사용자 로컬 캐시에 동기화
 * - 비로그인(게스트) 상태면: 게스트용 로컬 스토리지 또는 샘플 단어 반환
 */
export async function fetchVocabulary(targetUser?: User | null): Promise<VocabItem[]> {
  const isConfigured = checkIsSupabaseConfigured();
  const user = targetUser !== undefined ? targetUser : await getCurrentUser();
  const storageKey = getUserStorageKey(user?.id);

  // 1. Supabase 연동 시도
  if (isConfigured && supabase) {
    try {
      let query = supabase
        .from('vocab_words')
        .select('*')
        .order('created_at', { ascending: false });

      if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Supabase fetch error, fallback to local storage:', error);
      } else if (data) {
        const formatted: VocabItem[] = data.map((row: any) => ({
          id: row.id,
          word: row.word,
          phonetic: row.phonetic || '',
          partOfSpeech: row.part_of_speech || '',
          selectedMeaning: row.selected_meaning,
          allMeanings: row.all_meanings || [],
          contextSentence: row.context_sentence || '',
          candidateSentences: row.candidate_sentences || [],
          sourceMemo: row.source_memo || '',
          bookTitle: row.book_title || row.source_memo || '기본 단어장',
          quizCount: row.quiz_count || 0,
          correctCount: row.correct_count || 0,
          wrongCount: row.wrong_count || 0,
          consecutiveCorrect: row.consecutive_correct || 0,
          lastQuizDate: row.last_quiz_date || undefined,
          date: row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          created_at: row.created_at,
          user_id: row.user_id,
        }));

        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(formatted));
        }
        return formatted;
      }
    } catch (err) {
      console.warn('Supabase connection exception:', err);
    }
  }

  // 2. LocalStorage 로드
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return parsed.map((item: any) => ({
          ...item,
          bookTitle: item.bookTitle || item.sourceMemo || '기본 단어장',
          quizCount: item.quizCount || 0,
          correctCount: item.correctCount || 0,
          wrongCount: item.wrongCount || 0,
          consecutiveCorrect: item.consecutiveCorrect || 0,
        }));
      } catch (e) {
        console.error(e);
      }
    }

    // 게스트 첫 방문 시 샘플 단어 제공
    if (!user) {
      localStorage.setItem(storageKey, JSON.stringify(INITIAL_SAMPLES));
      return INITIAL_SAMPLES;
    }
  }

  return [];
}

/**
 * 단어를 추가합니다.
 */
export async function addVocabularyItem(item: VocabItem, userId?: string): Promise<boolean> {
  const normalizedItem: VocabItem = {
    ...item,
    bookTitle: item.bookTitle?.trim() || '기본 단어장',
    quizCount: item.quizCount || 0,
    correctCount: item.correctCount || 0,
    wrongCount: item.wrongCount || 0,
    consecutiveCorrect: item.consecutiveCorrect || 0,
    user_id: userId,
  };

  const storageKey = getUserStorageKey(userId);

  // 로컬 스토리지에 즉각 캐싱
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    let current: VocabItem[] = [];
    if (local) {
      try {
        current = JSON.parse(local);
      } catch {}
    }
    const updated = [normalizedItem, ...current];
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  // Supabase 동기화
  if (checkIsSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('vocab_words').insert({
        id: normalizedItem.id,
        user_id: userId || null,
        word: normalizedItem.word,
        phonetic: normalizedItem.phonetic,
        part_of_speech: normalizedItem.partOfSpeech,
        selected_meaning: normalizedItem.selectedMeaning,
        all_meanings: normalizedItem.allMeanings || [],
        context_sentence: normalizedItem.contextSentence,
        candidate_sentences: normalizedItem.candidateSentences || [],
        source_memo: normalizedItem.sourceMemo,
        book_title: normalizedItem.bookTitle,
        quiz_count: normalizedItem.quizCount,
        correct_count: normalizedItem.correctCount,
        wrong_count: normalizedItem.wrongCount,
        consecutive_correct: normalizedItem.consecutiveCorrect,
        last_quiz_date: normalizedItem.lastQuizDate || null,
      });
      if (error) {
        console.warn('Supabase insert error:', error);
      }
    } catch (err) {
      console.warn('Supabase insert exception:', err);
    }
  }

  return true;
}

/**
 * 퀴즈 풀이 결과를 갱신합니다.
 */
export async function updateQuizStat(id: string, isCorrect: boolean, userId?: string): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const storageKey = getUserStorageKey(userId);

  let nextQ = 1;
  let nextC = isCorrect ? 1 : 0;
  let nextW = isCorrect ? 0 : 1;
  let nextCons = isCorrect ? 1 : 0;

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const current: VocabItem[] = JSON.parse(local);
        const updated = current.map((item) => {
          if (item.id === id) {
            nextQ = (item.quizCount || 0) + 1;
            nextC = (item.correctCount || 0) + (isCorrect ? 1 : 0);
            nextW = (item.wrongCount || 0) + (isCorrect ? 0 : 1);
            nextCons = isCorrect ? (item.consecutiveCorrect || 0) + 1 : 0;
            return {
              ...item,
              quizCount: nextQ,
              correctCount: nextC,
              wrongCount: nextW,
              consecutiveCorrect: nextCons,
              lastQuizDate: todayStr,
            };
          }
          return item;
        });
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (checkIsSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('vocab_words')
        .update({
          quiz_count: nextQ,
          correct_count: nextC,
          wrong_count: nextW,
          consecutive_correct: nextCons,
          last_quiz_date: todayStr,
        })
        .eq('id', id);
    } catch (e) {
      console.warn('Supabase update stat exception:', e);
    }
  }
}

/**
 * 원문 문맥을 교체합니다.
 */
export async function updateVocabularyContext(
  id: string,
  newContextSentence: string,
  userId?: string
): Promise<boolean> {
  const storageKey = getUserStorageKey(userId);

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const current: VocabItem[] = JSON.parse(local);
        const updated = current.map((item) => {
          if (item.id === id) {
            return { ...item, contextSentence: newContextSentence };
          }
          return item;
        });
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
    }
  }

  if (checkIsSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('vocab_words')
        .update({ context_sentence: newContextSentence })
        .eq('id', id);
    } catch (e) {
      console.warn('Supabase update context exception:', e);
    }
  }

  return true;
}

/**
 * 단어를 삭제합니다.
 */
export async function deleteVocabularyItem(id: string, userId?: string): Promise<boolean> {
  const storageKey = getUserStorageKey(userId);

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const current: VocabItem[] = JSON.parse(local);
        const updated = current.filter((v) => v.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
    }
  }

  if (checkIsSupabaseConfigured() && supabase) {
    try {
      await supabase.from('vocab_words').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete exception:', err);
    }
  }

  return true;
}

/**
 * 로그인하지 않은 게스트 상태에서 저장해둔 단어들을 현재 로그인한 유저 계정으로 동기화(업로드)합니다.
 */
export async function syncGuestWordsToUser(userId: string): Promise<number> {
  if (!checkIsSupabaseConfigured() || !supabase || !userId) return 0;

  try {
    const guestLocal = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!guestLocal) return 0;

    const guestWords: VocabItem[] = JSON.parse(guestLocal);
    if (!guestWords || guestWords.length === 0) return 0;

    // Supabase에 배치 추가
    const toInsert = guestWords.map((w) => ({
      id: `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      word: w.word,
      phonetic: w.phonetic,
      part_of_speech: w.partOfSpeech,
      selected_meaning: w.selectedMeaning,
      all_meanings: w.allMeanings || [],
      context_sentence: w.contextSentence,
      candidate_sentences: w.candidateSentences || [],
      source_memo: w.sourceMemo,
      book_title: w.bookTitle || '기본 단어장',
      quiz_count: w.quizCount || 0,
      correct_count: w.correctCount || 0,
      wrong_count: w.wrongCount || 0,
      consecutive_correct: w.consecutiveCorrect || 0,
      last_quiz_date: w.lastQuizDate || null,
    }));

    const { error } = await supabase.from('vocab_words').upsert(toInsert);
    if (error) {
      console.warn('Sync error:', error);
      return 0;
    }

    return toInsert.length;
  } catch (err) {
    console.error('syncGuestWordsToUser exception:', err);
    return 0;
  }
}

/**
 * 샘플 단어들을 현재 사용자 계정에 로드합니다.
 */
export async function loadSamplesForUser(userId: string): Promise<VocabItem[]> {
  for (const sample of INITIAL_SAMPLES) {
    await addVocabularyItem(
      {
        ...sample,
        id: `${userId}_sample_${sample.word}_${Date.now()}`,
      },
      userId
    );
  }
  return fetchVocabulary();
}

/**
 * 초기 샘플로 리셋 (게스트 모드용)
 */
export async function resetWithSamples(): Promise<VocabItem[]> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLES));
  }
  return INITIAL_SAMPLES;
}

/**
 * 단어장 전체 삭제
 */
export async function clearAllVocab(userId?: string): Promise<void> {
  const storageKey = getUserStorageKey(userId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify([]));
  }
  if (checkIsSupabaseConfigured() && supabase) {
    try {
      if (userId) {
        await supabase.from('vocab_words').delete().eq('user_id', userId);
      } else {
        await supabase.from('vocab_words').delete().neq('id', '');
      }
    } catch (e) {
      console.warn('Supabase clear error:', e);
    }
  }
}
