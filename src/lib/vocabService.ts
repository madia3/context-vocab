import { VocabItem } from '@/types/vocab';
import { supabase, isSupabaseConfigured } from './supabase';

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
    date: "2026-11-15"
  }
];

const STORAGE_KEY = 'context_vocab_data';

export async function fetchVocabulary(): Promise<VocabItem[]> {
  // If Supabase is configured, fetch from Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('vocab_words')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error, falling back to localStorage:', error);
      } else if (data && data.length > 0) {
        const formatted: VocabItem[] = data.map((row: any) => ({
          id: row.id,
          word: row.word,
          phonetic: row.phonetic || '',
          partOfSpeech: row.part_of_speech || '',
          selectedMeaning: row.selected_meaning,
          allMeanings: row.all_meanings || [],
          contextSentence: row.context_sentence || '',
          sourceMemo: row.source_memo || '',
          bookTitle: row.book_title || row.source_memo || '기본 단어장',
          quizCount: row.quiz_count || 0,
          correctCount: row.correct_count || 0,
          date: row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          created_at: row.created_at,
          user_id: row.user_id,
        }));
        // Update local cache
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
        }
        return formatted;
      }
    } catch (err) {
      console.warn('Supabase connection exception:', err);
    }
  }

  // Fallback to localStorage or Samples
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        // Ensure bookTitle and quiz stats exist
        return parsed.map((item: any) => ({
          ...item,
          bookTitle: item.bookTitle || item.sourceMemo || '기본 단어장',
          quizCount: item.quizCount || 0,
          correctCount: item.correctCount || 0,
        }));
      } catch (e) {
        console.error(e);
      }
    }
    // Set initial samples if first time
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLES));
  }
  return INITIAL_SAMPLES;
}

export async function addVocabularyItem(item: VocabItem): Promise<boolean> {
  const normalizedItem: VocabItem = {
    ...item,
    bookTitle: item.bookTitle?.trim() || '기본 단어장',
    quizCount: item.quizCount || 0,
    correctCount: item.correctCount || 0,
  };

  // Local storage save first
  if (typeof window !== 'undefined') {
    const current = await fetchVocabulary();
    const updated = [normalizedItem, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // Sync to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('vocab_words').insert({
        id: normalizedItem.id,
        word: normalizedItem.word,
        phonetic: normalizedItem.phonetic,
        part_of_speech: normalizedItem.partOfSpeech,
        selected_meaning: normalizedItem.selectedMeaning,
        all_meanings: normalizedItem.allMeanings || [],
        context_sentence: normalizedItem.contextSentence,
        source_memo: normalizedItem.sourceMemo,
        book_title: normalizedItem.bookTitle,
        quiz_count: normalizedItem.quizCount,
        correct_count: normalizedItem.correctCount,
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

export async function updateQuizStat(id: string, isCorrect: boolean): Promise<void> {
  if (typeof window !== 'undefined') {
    const current = await fetchVocabulary();
    const updated = current.map((item) => {
      if (item.id === id) {
        const qCount = (item.quizCount || 0) + 1;
        const cCount = (item.correctCount || 0) + (isCorrect ? 1 : 0);
        return {
          ...item,
          quizCount: qCount,
          correctCount: cCount,
        };
      }
      return item;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // Update Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('vocab_words')
        .select('quiz_count, correct_count')
        .eq('id', id)
        .single();

      if (data) {
        const nextQ = (data.quiz_count || 0) + 1;
        const nextC = (data.correct_count || 0) + (isCorrect ? 1 : 0);
        await supabase
          .from('vocab_words')
          .update({ quiz_count: nextQ, correct_count: nextC })
          .eq('id', id);
      }
    } catch (e) {
      console.warn('Supabase update stat exception:', e);
    }
  }
}

export async function deleteVocabularyItem(id: string): Promise<boolean> {
  // Local storage remove
  if (typeof window !== 'undefined') {
    const current = await fetchVocabulary();
    const updated = current.filter((v) => v.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // Remove from Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('vocab_words').delete().eq('id', id);
      if (error) {
        console.warn('Supabase delete error:', error);
      }
    } catch (err) {
      console.warn('Supabase delete exception:', err);
    }
  }

  return true;
}

export async function resetWithSamples(): Promise<VocabItem[]> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLES));
  }
  return INITIAL_SAMPLES;
}

export async function clearAllVocab(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('vocab_words').delete().neq('id', '');
    } catch (e) {
      console.warn('Supabase clear error:', e);
    }
  }
}
