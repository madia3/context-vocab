export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  selectedMeaning: string;
  allMeanings?: string[];
  contextSentence: string;
  sourceMemo: string;
  date: string;
  created_at?: string;
  user_id?: string;
}

export interface MeaningOption {
  pos: string;
  def: string;
}

export interface DictSearchResult {
  word: string;
  phonetic: string;
  meanings: MeaningOption[];
  sourceName: string;
}
