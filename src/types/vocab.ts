export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  selectedMeaning: string;
  allMeanings?: string[];
  contextSentence: string;
  sourceMemo: string;
  bookTitle?: string; // 책 또는 레포트 이름
  quizCount?: number; // 퀴즈 푼 횟수
  correctCount?: number; // 맞춘 횟수
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
