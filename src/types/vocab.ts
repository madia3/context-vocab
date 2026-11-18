export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  selectedMeaning: string;
  allMeanings?: string[];
  contextSentence: string;
  sentenceTranslation?: string; // 원문 문맥/예문의 한글 해석 (단어장/퀴즈에서 클릭 시 표시)
  candidateSentences?: string[]; // 해당 페이지에서 발견된 전체 원문 문장 목록 (나중에 변경 가능)
  sourceMemo: string;
  bookTitle?: string; // 책 또는 레포트 이름
  quizCount?: number; // 퀴즈 푼 횟수
  correctCount?: number; // 맞춘 횟수
  wrongCount?: number; // 틀린 횟수
  consecutiveCorrect?: number; // 연속 정답 횟수
  lastQuizDate?: string; // 마지막 퀴즈 일자 (YYYY-MM-DD)
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
  exampleSentence?: string;
}
