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
    sourceMemo: "원서 문학 리포트",
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
    sourceMemo: "의학 저널 원서",
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
    sourceMemo: "IT 트렌드 리포트",
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
    sourceMemo: "기후 변화 특별 보고서",
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
        return JSON.parse(local);
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
  // Local storage save first
  if (typeof window !== 'undefined') {
    const current = await fetchVocabulary();
    const updated = [item, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // Sync to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('vocab_words').insert({
        id: item.id,
        word: item.word,
        phonetic: item.phonetic,
        part_of_speech: item.partOfSpeech,
        selected_meaning: item.selectedMeaning,
        all_meanings: item.allMeanings || [],
        context_sentence: item.contextSentence,
        source_memo: item.sourceMemo,
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
