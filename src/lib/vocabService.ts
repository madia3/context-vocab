import { VocabItem } from '@/types/vocab';
import { supabase, checkIsSupabaseConfigured, getCurrentUser } from './supabase';
import { User } from '@supabase/supabase-js';
import { ALL_RECOMMENDED_WORDS } from './recommendedWordbooks';

export const INITIAL_SAMPLES: VocabItem[] = [
  // =========================================================================
  // 단어장 1: 원서 첫걸음: 어린 왕자 (The Little Prince) - 10단어
  // =========================================================================
  {
    id: "sample_essential",
    word: "essential",
    phonetic: "/ɪˈsen.ʃəl/",
    partOfSpeech: "형용사",
    selectedMeaning: "본질적인, 극히 중요한",
    allMeanings: ["본질적인, 극히 중요한", "필수적인", "가장 중요한"],
    contextSentence: "What is essential is invisible to the eye.",
    sentenceTranslation: "가장 중요한 것은 눈에 보이지 않는다.",
    sourceMemo: "어린 왕자 제21장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 2,
    correctCount: 2,
    wrongCount: 0,
    consecutiveCorrect: 2,
    lastQuizDate: "2026-11-17",
    date: "2026-11-17"
  },
  {
    id: "sample_tame",
    word: "tame",
    phonetic: "/teɪm/",
    partOfSpeech: "동사",
    selectedMeaning: "길들이다, 친숙하게 만들다",
    allMeanings: ["길들이다, 다스리다", "친숙하게 만들다"],
    contextSentence: "If you tame me, then we shall need each other. To me, you will be unique in all the world.",
    sentenceTranslation: "네가 나를 길들인다면, 우리는 서로를 필요로 하게 될 거야. 나에게 넌 세상에 하나뿐인 존재가 될 테니까.",
    sourceMemo: "어린 왕자 제21장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 1,
    correctCount: 1,
    wrongCount: 0,
    consecutiveCorrect: 1,
    lastQuizDate: "2026-11-17",
    date: "2026-11-17"
  },
  {
    id: "sample_responsible",
    word: "responsible",
    phonetic: "/rɪˈspɑːn.sə.bəl/",
    partOfSpeech: "형용사",
    selectedMeaning: "책임이 있는, 책임을 져야 하는",
    allMeanings: ["책임이 있는", "신뢰할 수 있는"],
    contextSentence: "You become responsible, forever, for what you have tamed.",
    sentenceTranslation: "네가 길들인 것에 대해서는 영원히 책임을 져야 해.",
    sourceMemo: "어린 왕자 제21장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_judge",
    word: "judge",
    phonetic: "/dʒʌdʒ/",
    partOfSpeech: "동사",
    selectedMeaning: "판단하다, 심판하다",
    allMeanings: ["판단하다", "평가하다", "재판하다"],
    contextSentence: "It is much more difficult to judge oneself than to judge others.",
    sentenceTranslation: "다른 사람을 판단하는 것보다 자기 자신을 판단하는 것이 훨씬 더 어렵다.",
    sourceMemo: "어린 왕자 제10장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_devote",
    word: "devote",
    phonetic: "/dɪˈvoʊt/",
    partOfSpeech: "동사",
    selectedMeaning: "(시간, 노력 등을) 쏟다, 헌신하다",
    allMeanings: ["쏟다, 바치다", "헌신하다", "전념하다"],
    contextSentence: "It is the time you have devoted to your rose that makes your rose so important.",
    sentenceTranslation: "네 장미를 그토록 소중하게 만든 것은 네가 장미를 위해 쏟은 시간이야.",
    sourceMemo: "어린 왕자 제21장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_ordinary",
    word: "ordinary",
    phonetic: "/ˈɔːr.dən.er.i/",
    partOfSpeech: "형용사",
    selectedMeaning: "평범한, 보통의",
    allMeanings: ["평범한", "일반적인", "보통의"],
    contextSentence: "She is not just an ordinary rose; she is a flower I have watered and sheltered.",
    sentenceTranslation: "그녀는 평범한 장미가 아니야. 내가 물을 주고 비바람을 막아준 장미꽃이니까.",
    sourceMemo: "어린 왕자 제21장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_wander",
    word: "wander",
    phonetic: "/ˈwɑːn.dɚ/",
    partOfSpeech: "동사",
    selectedMeaning: "방랑하다, 헤매다, 거닐다",
    allMeanings: ["방랑하다", "헤매다", "돌아다니다"],
    contextSentence: "All men have stars, but for travelers who wander, the stars are guides.",
    sentenceTranslation: "모든 사람에게는 별이 있지만, 길을 헤매는 방랑자들에게 별은 길잡이가 되어 준다.",
    sourceMemo: "어린 왕자 제26장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_cherish",
    word: "cherish",
    phonetic: "/ˈtʃer.ɪʃ/",
    partOfSpeech: "동사",
    selectedMeaning: "소중히 여기다, 아끼다, 간직하다",
    allMeanings: ["소중히 여기다", "간직하다", "아끼다"],
    contextSentence: "Words are the source of misunderstandings, so we must cherish our silent moments together.",
    sentenceTranslation: "말은 오해의 근원이라서, 우리는 함께하는 고요한 순간들을 소중히 여겨야 한다.",
    sourceMemo: "어린 왕자 제21장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_invisible",
    word: "invisible",
    phonetic: "/ɪnˈvɪz.ə.bəl/",
    partOfSpeech: "형용사",
    selectedMeaning: "눈에 보이지 않는",
    allMeanings: ["눈에 보이지 않는", "숨겨진"],
    contextSentence: "The stars are beautiful, because of a flower that cannot be seen, invisible in the night.",
    sentenceTranslation: "밤하늘에 보이지 않는 꽃 한 송이가 있기에 별들은 그토록 아름다운 것이다.",
    sourceMemo: "어린 왕자 제24장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_secret",
    word: "secret",
    phonetic: "/ˈsiː.krət/",
    partOfSpeech: "명사",
    selectedMeaning: "비밀, 비결",
    allMeanings: ["비밀", "비결", "신비"],
    contextSentence: "And now here is my secret, a very simple secret: It is only with the heart that one can see rightly.",
    sentenceTranslation: "이제 내 비밀을 말해줄게, 아주 단순한 비밀이야: 마음으로 보아야만 분명하게 볼 수 있다는 거야.",
    sourceMemo: "어린 왕자 제21장",
    bookTitle: "원서 첫걸음: 어린 왕자",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },

  // =========================================================================
  // 단어장 2: 스탠포드 명연설: 인생을 바꾸는 문장 - 10단어
  // =========================================================================
  {
    id: "sample_connect",
    word: "connect",
    phonetic: "/kəˈnekt/",
    partOfSpeech: "동사",
    selectedMeaning: "연결하다, 이어지다",
    allMeanings: ["연결하다", "이어지다", "관련시키다"],
    contextSentence: "You can't connect the dots looking forward; you can only connect them looking backwards.",
    sentenceTranslation: "앞을 내다보며 점들을 연결할 수는 없습니다. 뒤돌아볼 때에만 점들을 연결할 수 있죠.",
    sourceMemo: "스티브 잡스 2005 스탠포드 연설",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 2,
    correctCount: 2,
    wrongCount: 0,
    consecutiveCorrect: 2,
    lastQuizDate: "2026-11-17",
    date: "2026-11-17"
  },
  {
    id: "sample_curiosity",
    word: "curiosity",
    phonetic: "/ˌkjʊr.iˈɑː.sə.t̬i/",
    partOfSpeech: "명사",
    selectedMeaning: "호기심, 진기함",
    allMeanings: ["호기심", "신기함", "진기한 것"],
    contextSentence: "Much of what I stumbled into by following my curiosity and intuition turned out to be priceless later on.",
    sentenceTranslation: "호기심과 직관을 따라 우연히 부딪혔던 많은 것들이 나중에 값을 매길 수 없을 만큼 값진 것이 되었습니다.",
    sourceMemo: "스티브 잡스 2005 스탠포드 연설",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_destination",
    word: "destination",
    phonetic: "/ˌdes.təˈneɪ.ʃən/",
    partOfSpeech: "명사",
    selectedMeaning: "목적지, 종착역",
    allMeanings: ["목적지", "종착점", "도착지"],
    contextSentence: "Death is the destination we all share; no one has ever escaped it.",
    sentenceTranslation: "죽음은 우리 모두가 공유하는 종착역입니다. 누구도 그것을 피한 적이 없습니다.",
    sourceMemo: "스티브 잡스 2005 스탠포드 연설",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_courage",
    word: "courage",
    phonetic: "/ˈkɝː.ɪdʒ/",
    partOfSpeech: "명사",
    selectedMeaning: "용기, 담력",
    allMeanings: ["용기", "담력", "배짱"],
    contextSentence: "Have the courage to follow your heart and intuition; they somehow already know what you truly want to become.",
    sentenceTranslation: "가슴과 직관을 따를 수 있는 용기를 가지세요. 그것들은 당신이 진정으로 무엇이 되고 싶어 하는지 이미 알고 있습니다.",
    sourceMemo: "스티브 잡스 2005 스탠포드 연설",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 1,
    correctCount: 1,
    wrongCount: 0,
    consecutiveCorrect: 1,
    lastQuizDate: "2026-11-17",
    date: "2026-11-17"
  },
  {
    id: "sample_settle",
    word: "settle",
    phonetic: "/ˈset̬.əl/",
    partOfSpeech: "동사",
    selectedMeaning: "안주하다, 만족하다, 정착하다",
    allMeanings: ["안주하다", "정착하다", "해결하다"],
    contextSentence: "If you haven't found what you love yet, keep looking. Don't settle.",
    sentenceTranslation: "아직 좋아하는 일을 찾지 못했다면 계속 찾으세요. 안주하지 마세요.",
    sourceMemo: "스티브 잡스 2005 스탠포드 연설",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_perspective",
    word: "perspective",
    phonetic: "/pɚˈspek.tɪv/",
    partOfSpeech: "명사",
    selectedMeaning: "관점, 시각, 원근법",
    allMeanings: ["관점, 시각", "원근법", "균형감"],
    contextSentence: "A shift in your perspective can transform a frustrating setback into a profound opportunity.",
    sentenceTranslation: "관점의 전환은 좌절스러운 실패를 엄청난 기회로 바꿀 수 있습니다.",
    sourceMemo: "명연설 & 자기계발 에세이",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_obstacle",
    word: "obstacle",
    phonetic: "/ˈɑːb.stə.kəl/",
    partOfSpeech: "명사",
    selectedMeaning: "장애물, 걸림돌",
    allMeanings: ["장애물", "걸림돌", "방해물"],
    contextSentence: "The obstacle in our path becomes the path. What stands in the way becomes the way.",
    sentenceTranslation: "우리 앞을 가로막는 장애물이 곧 길이 됩니다. 앞길을 가로막는 것이 바로 나아갈 길이 됩니다.",
    sourceMemo: "스토아 철학 명언",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_resilience",
    word: "resilience",
    phonetic: "/rɪˈzɪl.jəns/",
    partOfSpeech: "명사",
    selectedMeaning: "회복탄력성, 회복력, 탄성",
    allMeanings: ["회복탄력성", "탄력", "회복력"],
    contextSentence: "True resilience is not about avoiding difficulty, but having the inner strength to rise each time you stumble.",
    sentenceTranslation: "진정한 회복탄력성이란 어려움을 피하는 것이 아니라, 넘어질 때마다 다시 일어설 수 있는 내면의 힘을 갖는 것입니다.",
    sourceMemo: "회복탄력성 명연설",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_passion",
    word: "passion",
    phonetic: "/ˈpæʃ.ən/",
    partOfSpeech: "명사",
    selectedMeaning: "열정, 정열",
    allMeanings: ["열정", "정열", "격정"],
    contextSentence: "The only way to do truly exceptional work is to love what you do with genuine passion.",
    sentenceTranslation: "진정으로 위대한 일을 하는 유일한 방법은 당신이 하는 일을 진정한 열정으로 사랑하는 것입니다.",
    sourceMemo: "스티브 잡스 2005 스탠포드 연설",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_inspire",
    word: "inspire",
    phonetic: "/ɪnˈspaɪr/",
    partOfSpeech: "동사",
    selectedMeaning: "영감을 주다, 고무하다",
    allMeanings: ["영감을 주다", "고무하다", "격려하다"],
    contextSentence: "Great leaders inspire people not with hollow words, but with the integrity of how they live.",
    sentenceTranslation: "위대한 리더는 공허한 말이 아니라 삶의 진실성으로 사람들에게 영감을 줍니다.",
    sourceMemo: "리더십 명강연",
    bookTitle: "스탠포드 명연설: 인생을 바꾸는 문장",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },

  // =========================================================================
  // 단어장 3: 스마트 스타터: 교양 원서 필수 단어 - 10단어
  // =========================================================================
  {
    id: "sample_ubiquitous",
    word: "ubiquitous",
    phonetic: "/juːˈbɪk.wə.təs/",
    partOfSpeech: "형용사",
    selectedMeaning: "어디에나 존재하는, 아주 흔한",
    allMeanings: ["어디에나 존재하는, 아주 흔한", "도처에 나타나는"],
    contextSentence: "Smartphones and artificial intelligence have become truly ubiquitous in every aspect of modern communication.",
    sentenceTranslation: "스마트폰과 인공지능은 현대 통신의 모든 영역에서 진정 어디에나 존재하는 것이 되었습니다.",
    sourceMemo: "IT 트렌드",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 2,
    correctCount: 2,
    wrongCount: 0,
    consecutiveCorrect: 2,
    lastQuizDate: "2026-11-17",
    date: "2026-11-17"
  },
  {
    id: "sample_mitigate",
    word: "mitigate",
    phonetic: "/ˈmɪt.ɪ.ɡeɪt/",
    partOfSpeech: "동사",
    selectedMeaning: "(고통, 피해, 위험 등을) 완화하다, 경감시키다",
    allMeanings: ["완화하다, 경감시키다", "누그러뜨리다"],
    contextSentence: "Governments must implement strict policies to mitigate the severe consequences of climate crisis.",
    sentenceTranslation: "정부는 기후 위기의 심각한 영향을 완화하기 위해 엄격한 정책을 시행해야 합니다.",
    sourceMemo: "기후 리포트 3장",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 1,
    correctCount: 1,
    wrongCount: 0,
    consecutiveCorrect: 1,
    lastQuizDate: "2026-11-17",
    date: "2026-11-17"
  },
  {
    id: "sample_pragmatic",
    word: "pragmatic",
    phonetic: "/præɡˈmæt.ɪk/",
    partOfSpeech: "형용사",
    selectedMeaning: "실용적인, 현실적인",
    allMeanings: ["실용적인, 실무적인", "현실주의적인"],
    contextSentence: "Instead of debating theoretical models, the team adopted a pragmatic approach to launch the MVP quickly.",
    sentenceTranslation: "이론적인 모델을 논쟁하는 대신, 팀은 MVP를 빠르게 출시하기 위해 실용적인 접근 방식을 채택했습니다.",
    sourceMemo: "스타트업 경영학 원서",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_inevitable",
    word: "inevitable",
    phonetic: "/ɪnˈev.ə.t̬ə.bəl/",
    partOfSpeech: "형용사",
    selectedMeaning: "불가피한, 필연적인",
    allMeanings: ["불가피한", "필연적인", "피할 수 없는"],
    contextSentence: "Constant technological transformation is inevitable, and our ability to adapt defines our future success.",
    sentenceTranslation: "지속적인 기술 변화는 불가피하며, 우리의 적응 능력이 미래의 성공을 좌우합니다.",
    sourceMemo: "포브스 테크 칼럼",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_empathy",
    word: "empathy",
    phonetic: "/ˈem.pə.θi/",
    partOfSpeech: "명사",
    selectedMeaning: "공감, 감정이입",
    allMeanings: ["공감", "감정이입", "이해"],
    contextSentence: "Deep empathy enables leaders to understand diverse perspectives and build genuine psychological safety.",
    sentenceTranslation: "깊은 공감은 리더가 다양한 관점을 이해하고 진정한 심리적 안정감을 구축할 수 있도록 합니다.",
    sourceMemo: "하버드 비즈니스 리뷰",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_authentic",
    word: "authentic",
    phonetic: "/ɑːˈθen.t̬ɪk/",
    partOfSpeech: "형용사",
    selectedMeaning: "진정한, 진짜의, 신뢰할 수 있는",
    allMeanings: ["진정한", "진짜의", "신뢰할 수 있는"],
    contextSentence: "Building an authentic brand requires transparent communication and unwavering consistency in values.",
    sentenceTranslation: "진정성 있는 브랜드를 구축하려면 투명한 소통과 흔들림 없는 가치 일관성이 필요합니다.",
    sourceMemo: "브랜드 전략 에세이",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_lucid",
    word: "lucid",
    phonetic: "/ˈluː.sɪd/",
    partOfSpeech: "형용사",
    selectedMeaning: "명쾌한, 명료한, 맑은",
    allMeanings: ["명쾌한, 명료한", "맑은", "의식이 또렷한"],
    contextSentence: "The author provided a lucid explanation of complex economic forces, making the concept accessible to general readers.",
    sentenceTranslation: "저자는 복잡한 경제적 힘에 대해 명쾌하게 설명하여 일반 독자들도 쉽게 이해할 수 있게 했습니다.",
    sourceMemo: "이코노미스트 서평",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_profound",
    word: "profound",
    phonetic: "/prəˈfaʊnd/",
    partOfSpeech: "형용사",
    selectedMeaning: "깊은, 심오한, 엄청난",
    allMeanings: ["심오한", "깊은", "엄청난"],
    contextSentence: "Reading timeless literature often leaves a profound and lasting impression on how we understand human nature.",
    sentenceTranslation: "시대를 초월한 고전을 읽는 것은 인간 본성을 이해하는 방식에 깊고 오래 지속되는 인상을 남깁니다.",
    sourceMemo: "타임지 문학 에세이",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_subtle",
    word: "subtle",
    phonetic: "/ˈsʌt̬.əl/",
    partOfSpeech: "형용사",
    selectedMeaning: "미묘한, 섬세한, 절묘한",
    allMeanings: ["미묘한", "섬세한", "감지하기 힘든"],
    contextSentence: "Experienced negotiators pay close attention to subtle shifts in vocal tone and non-verbal cues.",
    sentenceTranslation: "숙련된 협상가는 목소리 톤의 미묘한 변화와 비언어적 신호에 세심한 주의를 기울입니다.",
    sourceMemo: "협상의 심리학",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  },
  {
    id: "sample_versatile",
    word: "versatile",
    phonetic: "/ˈvɝː.sə.t̬əl/",
    partOfSpeech: "형용사",
    selectedMeaning: "다재다능한, 다용도의",
    allMeanings: ["다재다능한", "다용도의", "변화무쌍한"],
    contextSentence: "Python is renowned as a versatile programming language suitable for web development, automation, and machine learning.",
    sentenceTranslation: "파이썬은 웹 개발, 자동화, 머신러닝에 적합한 다재다능한 프로그래밍 언어로 널리 알려져 있습니다.",
    sourceMemo: "소프트웨어 엔지니어링 저널",
    bookTitle: "스마트 스타터: 교양 원서 필수 단어",
    quizCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    date: "2026-11-17"
  }
];

const GUEST_STORAGE_KEY = 'context_vocab_data';

function getUserStorageKey(userId?: string): string {
  return userId ? `context_vocab_user_${userId}` : GUEST_STORAGE_KEY;
}

export const GLOBAL_CLEAN_RESET_VERSION = 'v20261118_clean_30_korean_trans_v5';

/**
 * 단어 항목의 한글 문장 해석(sentenceTranslation)이 누락되었을 때
 * 30개 기본 프리셋(INITIAL_SAMPLES)에서 단어 및 문맥 문장을 매칭하여 한글 해석을 복원합니다.
 */
export function ensureSentenceTranslation(item: {
  word?: string;
  contextSentence?: string;
  sentenceTranslation?: string | null;
}): string {
  if (typeof item.sentenceTranslation === 'string' && item.sentenceTranslation.trim().length > 0) {
    return item.sentenceTranslation.trim();
  }
  const cleanWord = (item.word || '').trim().toLowerCase();
  if (!cleanWord) return '';

  const cleanContext = (item.contextSentence || '').trim().toLowerCase();
  const catalog = [...INITIAL_SAMPLES, ...ALL_RECOMMENDED_WORDS];
  const sample =
    catalog.find(
      (s) =>
        s.word.toLowerCase() === cleanWord &&
        cleanContext &&
        s.contextSentence.trim().toLowerCase() === cleanContext
    ) ||
    catalog.find((s) => s.word.toLowerCase() === cleanWord);

  return sample?.sentenceTranslation || '';
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
  const versionKey = user?.id ? `context_vocab_clean_ver_${user.id}` : 'context_vocab_clean_ver_guest';

  // 💡 모든 계정에 단어 초기화 및 기본 30개 자동 세팅
  if (typeof window !== 'undefined') {
    const isCleaned = localStorage.getItem(versionKey) === GLOBAL_CLEAN_RESET_VERSION;
    if (!isCleaned) {
      localStorage.setItem(versionKey, GLOBAL_CLEAN_RESET_VERSION);
      try {
        const resetItems = await resetWithSamples(user?.id);
        if (resetItems && resetItems.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(resetItems));
          return resetItems;
        }
      } catch (err) {
        console.warn('Auto reset to clean 30 samples error:', err);
      }
    }
  }

  // 1. Supabase 연동 시도 (로그인된 사용자가 있을 때만 Supabase와 동기화)
  if (isConfigured && supabase && user?.id) {
    try {
      const { data, error } = await supabase
        .from('vocab_words')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error, fallback to local storage:', error);
      } else if (data) {
        // 신규 유저 초기 세팅: 저장된 단어가 0개이고 아직 초기 세팅 이력이 없는 경우에만 3개 단어장(30단어) 자동 세팅
        if (data.length === 0) {
          const seededKey = `context_vocab_seeded_${user.id}`;
          const isLocalSeeded = typeof window !== 'undefined' ? localStorage.getItem(seededKey) === 'true' : false;
          const isMetaSeeded = Boolean(user.user_metadata?.vocab_seeded);

          if (!isLocalSeeded && !isMetaSeeded) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(seededKey, 'true');
            }
            const seeded = await loadSamplesForUser(user.id);
            if (seeded && seeded.length > 0) {
              return seeded;
            }
          } else if (typeof window !== 'undefined' && !isLocalSeeded) {
            localStorage.setItem(seededKey, 'true');
          }
        } else if (typeof window !== 'undefined') {
          localStorage.setItem(`context_vocab_seeded_${user.id}`, 'true');
        }

        // 로컬 캐시에서 기존 번역본 색인
        const localStr = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
        let localItems: VocabItem[] = [];
        if (localStr) {
          try {
            localItems = JSON.parse(localStr);
          } catch {}
        }
        const localById = new Map<string, VocabItem>(localItems.map((l) => [l.id, l]));
        const localByWord = new Map<string, VocabItem>(localItems.map((l) => [String(l.word || '').toLowerCase(), l]));

        const formatted: VocabItem[] = data.map((row: any) => {
          const localMatch = localById.get(row.id) || localByWord.get(String(row.word || '').toLowerCase());
          const directTranslation =
            typeof row.sentence_translation === 'string' && row.sentence_translation.trim()
              ? row.sentence_translation.trim()
              : (localMatch?.sentenceTranslation?.trim() || '');

          const finalTranslation =
            directTranslation ||
            ensureSentenceTranslation({
              word: row.word,
              contextSentence: row.context_sentence,
              sentenceTranslation: directTranslation,
            });

          return {
            id: row.id,
            word: row.word,
            phonetic: row.phonetic || '',
            partOfSpeech: row.part_of_speech || '',
            selectedMeaning: row.selected_meaning,
            allMeanings: row.all_meanings || [],
            contextSentence: row.context_sentence || '',
            sentenceTranslation: finalTranslation,
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
          };
        });

        if (typeof window !== 'undefined') {
          // 로컬 캐시와 병합하여 최신 상태 유지 (샘플 더미 제외)
          const serverIds = new Set(formatted.map((f) => f.id));
          const unsynced = localItems.filter(
            (l) => !serverIds.has(l.id) && !String(l.id).startsWith('sample_')
          );
          const merged = [...unsynced, ...formatted];
          localStorage.setItem(storageKey, JSON.stringify(merged));
          return merged;
        }
        return formatted;
      }
    } catch (err) {
      console.warn('Supabase connection exception:', err);
    }
  }

  // 2. LocalStorage 로드 (비로그인 게스트 모드 또는 Supabase 오프라인 시)
  if (typeof window !== 'undefined') {
    const isGuestCleared = !user && localStorage.getItem('context_vocab_guest_cleared') === 'true';
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0 && isGuestCleared) {
            return [];
          }
          if (parsed.length > 0) {
            // 비로그인 게스트인 경우, 구버전 햄릿 더미 단어 자동 정리 및 신규 기본 단어장 3종 보장
            if (!user) {
              const cleaned = parsed.filter(
                (item: any) => !item.bookTitle?.includes('햄릿') && !item.sourceMemo?.includes('햄릿')
              );
              const hasNewBooks = cleaned.some(
                (item: any) => item.bookTitle === '원서 첫걸음: 어린 왕자'
              );
              if (!hasNewBooks || cleaned.length === 0) {
                if (!isGuestCleared) {
                  localStorage.setItem(storageKey, JSON.stringify(INITIAL_SAMPLES));
                  return INITIAL_SAMPLES;
                }
                return [];
              }
              // 기존 캐시된 단어들의 sentenceTranslation 누락 시 INITIAL_SAMPLES 기준으로 자동 복원
              cleaned.forEach((item: any) => {
                if (!item.sentenceTranslation) {
                  item.sentenceTranslation = ensureSentenceTranslation(item);
                }
              });
              if (cleaned.length !== parsed.length) {
                localStorage.setItem(storageKey, JSON.stringify(cleaned));
              }
              return cleaned.map((item: any) => ({
                ...item,
                sentenceTranslation: ensureSentenceTranslation(item),
                bookTitle: item.bookTitle || item.sourceMemo || '기본 단어장',
                quizCount: item.quizCount || 0,
                correctCount: item.correctCount || 0,
                wrongCount: item.wrongCount || 0,
                consecutiveCorrect: item.consecutiveCorrect || 0,
              }));
            }
            parsed.forEach((item: any) => {
              if (!item.sentenceTranslation) {
                item.sentenceTranslation = ensureSentenceTranslation(item);
              }
            });
            return parsed;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 게스트 방문 시 항상 기본 단어장 3종(30단어) 제공 (명시적 비우기 상태가 아닌 경우)
    if (!user && !isGuestCleared) {
      localStorage.setItem('context_vocab_visited', 'true');
      localStorage.setItem(storageKey, JSON.stringify(INITIAL_SAMPLES));
      return INITIAL_SAMPLES;
    }
  }

  return (!user && (typeof window === 'undefined' || localStorage.getItem('context_vocab_guest_cleared') !== 'true'))
    ? INITIAL_SAMPLES
    : [];

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

  // Supabase 동기화 (로그인된 사용자가 있을 때만 실행)
  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      const insertPayload: any = {
        id: normalizedItem.id,
        user_id: userId,
        word: normalizedItem.word,
        phonetic: normalizedItem.phonetic,
        part_of_speech: normalizedItem.partOfSpeech,
        selected_meaning: normalizedItem.selectedMeaning,
        all_meanings: normalizedItem.allMeanings || [],
        context_sentence: normalizedItem.contextSentence,
        sentence_translation: normalizedItem.sentenceTranslation || null,
        candidate_sentences: normalizedItem.candidateSentences || [],
        source_memo: normalizedItem.sourceMemo,
        book_title: normalizedItem.bookTitle,
        quiz_count: normalizedItem.quizCount,
        correct_count: normalizedItem.correctCount,
        wrong_count: normalizedItem.wrongCount,
        consecutive_correct: normalizedItem.consecutiveCorrect,
        last_quiz_date: normalizedItem.lastQuizDate || null,
      };

      const { error } = await supabase.from('vocab_words').insert(insertPayload);
      if (error) {
        if (error.message?.includes('sentence_translation')) {
          delete insertPayload.sentence_translation;
          await supabase.from('vocab_words').insert(insertPayload);
        } else {
          console.warn('Supabase insert error:', error);
        }
      }
    } catch (err) {
      console.warn('Supabase insert exception:', err);
    }
  }

  return true;
}

/**
 * 단어를 추가하거나, 동일한 단어장(bookTitle) 내에 이미 등록된 단어인 경우 관련 원문 문장(candidateSentences)을 누적 병합합니다.
 */
export async function saveOrMergeVocabularyItem(
  item: VocabItem,
  userId?: string
): Promise<{ isMerged: boolean; item: VocabItem; totalSentences: number }> {
  const targetWord = item.word.trim().toLowerCase();
  const targetBook = item.bookTitle?.trim() || '기본 단어장';
  const storageKey = getUserStorageKey(userId);

  let existingItem: VocabItem | null = null;
  let currentList: VocabItem[] = [];

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        currentList = JSON.parse(local);
        // 동일 단어장 내 동일 단어(대소문자 무관) 우선 탐색
        existingItem =
          currentList.find(
            (v) =>
              v.word.trim().toLowerCase() === targetWord &&
              (v.bookTitle?.trim() || '기본 단어장') === targetBook
          ) || null;
      } catch {}
    }
  }

  // 1. 이미 해당 단어장에 등록되어 있는 단어인 경우 -> 관련 문장 누적 병합!
  if (existingItem) {
    const newContext = item.contextSentence?.trim() || '';
    const existingSentences = existingItem.candidateSentences || [];
    if (existingItem.contextSentence && !existingSentences.includes(existingItem.contextSentence)) {
      existingSentences.push(existingItem.contextSentence);
    }
    const incomingSentences = item.candidateSentences || [];
    if (newContext && !incomingSentences.includes(newContext)) {
      incomingSentences.push(newContext);
    }

    // 중복 없이 모든 원문 문장 병합 (새로 들어온 문장을 가장 앞쪽에 배치)
    const mergedSentences = Array.from(
      new Set(
        [newContext, ...incomingSentences, ...existingSentences].filter(
          (s) => s && s.trim().length > 0
        )
      )
    );

    // 출처 메모 병합
    const newMemo = item.sourceMemo?.trim() || '';
    let mergedMemo = existingItem.sourceMemo || '';
    if (newMemo && !mergedMemo.includes(newMemo)) {
      mergedMemo = mergedMemo ? `${mergedMemo} / ${newMemo}` : newMemo;
    }

    // 뜻 목록 병합
    const mergedMeanings = Array.from(
      new Set([
        ...(existingItem.allMeanings || [existingItem.selectedMeaning]),
        ...(item.allMeanings || [item.selectedMeaning]),
        item.selectedMeaning,
      ].filter(Boolean))
    );

    const mergedItem: VocabItem = {
      ...existingItem,
      contextSentence: newContext || existingItem.contextSentence, // 최신 등록 문장을 대표 문장으로
      sentenceTranslation: item.sentenceTranslation || existingItem.sentenceTranslation,
      candidateSentences: mergedSentences,
      sourceMemo: mergedMemo,
      allMeanings: mergedMeanings,
      selectedMeaning: item.selectedMeaning || existingItem.selectedMeaning,
      partOfSpeech: item.partOfSpeech || existingItem.partOfSpeech,
      bookTitle: targetBook,
    };

    // 로컬 스토리지 업데이트
    if (typeof window !== 'undefined') {
      const updatedList = currentList.map((v) => (v.id === existingItem!.id ? mergedItem : v));
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    }

    // Supabase 업데이트 (로그인된 사용자가 있을 때만 실행)
    if (checkIsSupabaseConfigured() && supabase && userId) {
      try {
        const updatePayload: any = {
          context_sentence: mergedItem.contextSentence,
          sentence_translation: mergedItem.sentenceTranslation || null,
          candidate_sentences: mergedItem.candidateSentences,
          source_memo: mergedItem.sourceMemo,
          all_meanings: mergedItem.allMeanings,
          selected_meaning: mergedItem.selectedMeaning,
          part_of_speech: mergedItem.partOfSpeech,
          book_title: mergedItem.bookTitle,
        };
        const { error } = await supabase
          .from('vocab_words')
          .update(updatePayload)
          .eq('id', mergedItem.id)
          .eq('user_id', userId);
        if (error && error.message?.includes('sentence_translation')) {
          delete updatePayload.sentence_translation;
          await supabase
            .from('vocab_words')
            .update(updatePayload)
            .eq('id', mergedItem.id)
            .eq('user_id', userId);
        }
      } catch (err) {
        console.warn('Supabase merge exception:', err);
      }
    }

    return {
      isMerged: true,
      item: mergedItem,
      totalSentences: mergedSentences.length,
    };
  }

  // 2. 신규 단어인 경우 -> 일반 추가
  await addVocabularyItem({ ...item, bookTitle: targetBook }, userId);
  return {
    isMerged: false,
    item: { ...item, bookTitle: targetBook },
    totalSentences: item.candidateSentences?.length || 1,
  };
}

function mapVocabItemToDbRow(item: VocabItem, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    word: item.word,
    phonetic: item.phonetic || '',
    part_of_speech: item.partOfSpeech || '',
    selected_meaning: item.selectedMeaning,
    all_meanings: item.allMeanings || [item.selectedMeaning].filter(Boolean),
    context_sentence: item.contextSentence || '',
    sentence_translation: item.sentenceTranslation || null,
    candidate_sentences:
      item.candidateSentences && item.candidateSentences.length > 0
        ? item.candidateSentences
        : item.contextSentence
        ? [item.contextSentence]
        : [],
    source_memo: item.sourceMemo || '',
    book_title: item.bookTitle?.trim() || '기본 단어장',
    quiz_count: item.quizCount || 0,
    correct_count: item.correctCount || 0,
    wrong_count: item.wrongCount || 0,
    consecutive_correct: item.consecutiveCorrect || 0,
    last_quiz_date: item.lastQuizDate || null,
  };
}

function mergeVocabItemFields(existingItem: VocabItem, incomingItem: VocabItem, targetBook: string): VocabItem {
  const newContext = incomingItem.contextSentence?.trim() || '';
  const existingSentences = [...(existingItem.candidateSentences || [])];
  if (existingItem.contextSentence && !existingSentences.includes(existingItem.contextSentence)) {
    existingSentences.push(existingItem.contextSentence);
  }
  const incomingSentences = [...(incomingItem.candidateSentences || [])];
  if (newContext && !incomingSentences.includes(newContext)) {
    incomingSentences.push(newContext);
  }

  const mergedSentences = Array.from(
    new Set(
      [newContext, ...incomingSentences, ...existingSentences].filter(
        (s) => s && s.trim().length > 0
      )
    )
  );

  const newMemo = incomingItem.sourceMemo?.trim() || '';
  let mergedMemo = existingItem.sourceMemo || '';
  if (newMemo && !mergedMemo.includes(newMemo)) {
    mergedMemo = mergedMemo ? `${mergedMemo} / ${newMemo}` : newMemo;
  }

  const mergedMeanings = Array.from(
    new Set([
      ...(existingItem.allMeanings || [existingItem.selectedMeaning]),
      ...(incomingItem.allMeanings || [incomingItem.selectedMeaning]),
      incomingItem.selectedMeaning,
    ].filter(Boolean))
  );

  return {
    ...existingItem,
    contextSentence: newContext || existingItem.contextSentence,
    sentenceTranslation: incomingItem.sentenceTranslation || existingItem.sentenceTranslation || '',
    candidateSentences: mergedSentences,
    sourceMemo: mergedMemo,
    allMeanings: mergedMeanings,
    selectedMeaning: incomingItem.selectedMeaning || existingItem.selectedMeaning,
    partOfSpeech: incomingItem.partOfSpeech || existingItem.partOfSpeech,
    bookTitle: targetBook,
  };
}

/**
 * 여러 단어를 단일 트랜잭션/배치로 효율적으로 병합 및 추가합니다.
 */
export async function saveOrMergeVocabularyItemsBatch(
  items: VocabItem[],
  userId?: string
): Promise<{ mergedCount: number; addedCount: number; items: VocabItem[] }> {
  if (!items || items.length === 0) {
    return { mergedCount: 0, addedCount: 0, items: [] };
  }

  const storageKey = getUserStorageKey(userId);
  let currentList: VocabItem[] = [];

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        currentList = JSON.parse(local);
      } catch {}
    }
  }

  let mergedCount = 0;
  let addedCount = 0;
  const touchedMap = new Map<string, VocabItem>();
  const newItemsToPrepend: VocabItem[] = [];

  for (const rawItem of items) {
    const targetWord = rawItem.word.trim().toLowerCase();
    const targetBook = rawItem.bookTitle?.trim() || '기본 단어장';

    const batchMatchIdx = newItemsToPrepend.findIndex(
      (v) =>
        v.word.trim().toLowerCase() === targetWord &&
        (v.bookTitle?.trim() || '기본 단어장') === targetBook
    );
    if (batchMatchIdx !== -1) {
      const mergedInBatch = mergeVocabItemFields(newItemsToPrepend[batchMatchIdx], rawItem, targetBook);
      newItemsToPrepend[batchMatchIdx] = mergedInBatch;
      touchedMap.set(mergedInBatch.id, mergedInBatch);
      mergedCount++;
      continue;
    }

    const existingIdx = currentList.findIndex(
      (v) =>
        v.word.trim().toLowerCase() === targetWord &&
        (v.bookTitle?.trim() || '기본 단어장') === targetBook
    );

    if (existingIdx !== -1) {
      const mergedItem = mergeVocabItemFields(currentList[existingIdx], rawItem, targetBook);
      currentList[existingIdx] = mergedItem;
      touchedMap.set(mergedItem.id, mergedItem);
      mergedCount++;
    } else {
      const normalizedNew: VocabItem = {
        ...rawItem,
        bookTitle: targetBook,
        quizCount: rawItem.quizCount || 0,
        correctCount: rawItem.correctCount || 0,
        wrongCount: rawItem.wrongCount || 0,
        consecutiveCorrect: rawItem.consecutiveCorrect || 0,
        user_id: userId,
      };
      newItemsToPrepend.push(normalizedNew);
      touchedMap.set(normalizedNew.id, normalizedNew);
      addedCount++;
    }
  }

  const finalList = [...newItemsToPrepend, ...currentList];

  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify(finalList));
  }

  const touchedItems = Array.from(touchedMap.values());

  if (checkIsSupabaseConfigured() && supabase && userId && touchedItems.length > 0) {
    try {
      const dbRows = touchedItems.map((item) => mapVocabItemToDbRow(item, userId));
      const { error } = await supabase.from('vocab_words').upsert(dbRows);
      if (error) {
        console.warn('Supabase batch upsert error:', error);
      }
    } catch (err) {
      console.warn('Supabase batch upsert exception:', err);
    }
  }

  return {
    mergedCount,
    addedCount,
    items: touchedItems,
  };
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

  if (checkIsSupabaseConfigured() && supabase && userId) {
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
        .eq('id', id)
        .eq('user_id', userId);
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

  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      await supabase
        .from('vocab_words')
        .update({ context_sentence: newContextSentence })
        .eq('id', id)
        .eq('user_id', userId);
    } catch (e) {
      console.warn('Supabase update context exception:', e);
    }
  }

  return true;
}

/**
 * 문맥 문장의 한글 해석을 업데이트합니다.
 */
export async function updateVocabularySentenceTranslation(
  id: string,
  translation: string,
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
            return { ...item, sentenceTranslation: translation };
          }
          return item;
        });
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
    }
  }

  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      const { error } = await supabase
        .from('vocab_words')
        .update({ sentence_translation: translation })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        console.warn('Supabase update sentence_translation error:', error);
      }
    } catch (e) {
      console.warn('Supabase update sentence_translation exception:', e);
    }
  }

  return true;
}

/**
 * 단어 항목의 세부 정보(선택 뜻, 품사, 단어장, 메모 등)를 일괄 수정합니다.
 */
export async function updateVocabularyItemDetails(
  id: string,
  updates: {
    selectedMeaning?: string;
    partOfSpeech?: string;
    bookTitle?: string;
    sourceMemo?: string;
    sentenceTranslation?: string;
  },
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
            const nextMeaning = updates.selectedMeaning?.trim() || item.selectedMeaning;
            const nextAllMeanings = Array.from(
              new Set([nextMeaning, ...(item.allMeanings || [])].filter(Boolean))
            );
            return {
              ...item,
              selectedMeaning: nextMeaning,
              allMeanings: nextAllMeanings,
              partOfSpeech: updates.partOfSpeech?.trim() || item.partOfSpeech,
              bookTitle: updates.bookTitle?.trim() || item.bookTitle || '기본 단어장',
              sourceMemo: updates.sourceMemo !== undefined ? updates.sourceMemo.trim() : item.sourceMemo,
              sentenceTranslation:
                updates.sentenceTranslation !== undefined
                  ? updates.sentenceTranslation.trim()
                  : item.sentenceTranslation,
            };
          }
          return item;
        });
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
    }
  }

  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      const patch: Record<string, any> = {};
      if (updates.selectedMeaning?.trim()) patch.selected_meaning = updates.selectedMeaning.trim();
      if (updates.partOfSpeech?.trim()) patch.part_of_speech = updates.partOfSpeech.trim();
      if (updates.bookTitle?.trim()) patch.book_title = updates.bookTitle.trim();
      if (updates.sourceMemo !== undefined) patch.source_memo = updates.sourceMemo.trim();
      if (updates.sentenceTranslation !== undefined) patch.sentence_translation = updates.sentenceTranslation.trim();

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from('vocab_words')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId);
        if (error && error.message?.includes('sentence_translation')) {
          delete patch.sentence_translation;
          if (Object.keys(patch).length > 0) {
            await supabase
              .from('vocab_words')
              .update(patch)
              .eq('id', id)
              .eq('user_id', userId);
          }
        }
      }
    } catch (e) {
      console.warn('Supabase updateVocabularyItemDetails exception:', e);
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

  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      await supabase
        .from('vocab_words')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('Supabase delete exception:', err);
    }
  }

  return true;
}

/**
 * 특정 단어장의 모든 단어를 다른 단어장으로 이동(변경)합니다.
 */
export async function moveWordsToAnotherBook(
  sourceBook: string,
  targetBook: string,
  userId?: string
): Promise<boolean> {
  const normalizedTarget = targetBook.trim() || '기본 단어장';
  const storageKey = getUserStorageKey(userId);

  // 로컬 스토리지 업데이트
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const current: VocabItem[] = JSON.parse(local);
        const updated = current.map((item) => {
          const itemBook = item.bookTitle || '기본 단어장';
          if (itemBook === sourceBook) {
            return { ...item, bookTitle: normalizedTarget };
          }
          return item;
        });
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('LocalStorage moveWordsToAnotherBook error:', e);
      }
    }
  }

  // Supabase 동기화 (로그인된 사용자의 단어만 변경)
  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      let query = supabase
        .from('vocab_words')
        .update({ book_title: normalizedTarget })
        .eq('user_id', userId);

      if (sourceBook === '기본 단어장') {
        query = query.or('book_title.eq.기본 단어장,book_title.is.null');
      } else {
        query = query.eq('book_title', sourceBook);
      }

      const { error } = await query;
      if (error) {
        console.warn('Supabase moveWordsToAnotherBook error:', error);
      }
    } catch (err) {
      console.warn('Supabase moveWordsToAnotherBook exception:', err);
    }
  }

  return true;
}

/**
 * 특정 단어장 및 그 단어장에 속한 모든 단어를 일괄 삭제합니다.
 */
export async function deleteWordsByBook(
  bookTitle: string,
  userId?: string
): Promise<boolean> {
  const storageKey = getUserStorageKey(userId);

  // 로컬 스토리지 업데이트
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const current: VocabItem[] = JSON.parse(local);
        const updated = current.filter(
          (item) => (item.bookTitle || '기본 단어장') !== bookTitle
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('LocalStorage deleteWordsByBook error:', e);
      }
    }
  }

  // Supabase 동기화 (로그인된 사용자의 단어만 삭제)
  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      let query = supabase
        .from('vocab_words')
        .delete()
        .eq('user_id', userId);

      if (bookTitle === '기본 단어장') {
        query = query.or('book_title.eq.기본 단어장,book_title.is.null');
      } else {
        query = query.eq('book_title', bookTitle);
      }

      const { error } = await query;
      if (error) {
        console.warn('Supabase deleteWordsByBook error:', error);
      }
    } catch (err) {
      console.warn('Supabase deleteWordsByBook exception:', err);
    }
  }

  return true;
}

/**
 * 로그인하지 않은 게스트 상태에서 직접 추가해둔 단어들을 현재 로그인한 유저 계정으로 동기화(업로드)합니다.
 * (기본 제공 샘플 단어인 sample_* / seed_* 항목은 중복 등록되지 않도록 자동 제외)
 */
export async function syncGuestWordsToUser(userId: string): Promise<number> {
  if (!checkIsSupabaseConfigured() || !supabase || !userId) return 0;

  try {
    const guestLocal = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!guestLocal) return 0;

    const guestWords: VocabItem[] = JSON.parse(guestLocal);
    if (!Array.isArray(guestWords) || guestWords.length === 0) return 0;

    // 기본 샘플 단어(sample_*, seed_*)는 제외하고, 게스트가 직접 추가한 커스텀 단어만 필터링
    const customGuestWords = guestWords.filter(
      (w) =>
        w &&
        w.id &&
        !String(w.id).startsWith('sample_') &&
        !String(w.id).startsWith('seed_')
    );

    if (customGuestWords.length === 0) return 0;

    // Supabase에 배치 추가
    const toInsert = customGuestWords.map((w) => ({
      id: `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      word: w.word,
      phonetic: w.phonetic,
      part_of_speech: w.partOfSpeech,
      selected_meaning: w.selectedMeaning,
      all_meanings: w.allMeanings || [],
      context_sentence: w.contextSentence,
      sentence_translation: w.sentenceTranslation || null,
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

    // 동기화 완료 후 게스트 스토리지는 기본 샘플 상태로 초기화하여 중복 재동기화 방지
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLES));

    return toInsert.length;
  } catch (err) {
    console.error('syncGuestWordsToUser exception:', err);
    return 0;
  }
}

/**
 * 샘플 단어들을 현재 사용자 계정에 로드합니다 (신규 가입 시 초기 3개 단어장 자동 세팅)
 */
export async function loadSamplesForUser(userId: string): Promise<VocabItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const itemsToInsert = INITIAL_SAMPLES.map((sample, idx) => ({
    id: `seed_${userId.slice(0, 8)}_${sample.word}_${idx}`,
    user_id: userId,
    word: sample.word,
    phonetic: sample.phonetic,
    part_of_speech: sample.partOfSpeech,
    selected_meaning: sample.selectedMeaning,
    all_meanings: sample.allMeanings || [],
    context_sentence: sample.contextSentence,
    sentence_translation: sample.sentenceTranslation || null,
    candidate_sentences: [sample.contextSentence],
    source_memo: sample.sourceMemo,
    book_title: sample.bookTitle,
    quiz_count: sample.quizCount || 0,
    correct_count: sample.correctCount || 0,
    wrong_count: sample.wrongCount || 0,
    consecutive_correct: sample.consecutiveCorrect || 0,
    last_quiz_date: sample.lastQuizDate || null,
  }));

  if (checkIsSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('vocab_words').upsert(itemsToInsert);
      if (error) {
        if (error.message?.includes('sentence_translation')) {
          const fallbackRows = itemsToInsert.map(({ sentence_translation, ...rest }: any) => rest);
          await supabase.from('vocab_words').upsert(fallbackRows);
        } else {
          console.warn('loadSamplesForUser supabase upsert error:', error);
        }
      }
      // 다른 기기/브라우저에서 로그인하더라도 이미 초기 샘플이 세팅되었음을 user_metadata에 기록
      supabase.auth.updateUser({ data: { vocab_seeded: true } }).catch(() => {});
    } catch (e) {
      console.warn('loadSamplesForUser supabase exception:', e);
    }
  }

  const formatted: VocabItem[] = itemsToInsert.map((row) => ({
    id: row.id,
    word: row.word,
    phonetic: row.phonetic,
    partOfSpeech: row.part_of_speech,
    selectedMeaning: row.selected_meaning,
    allMeanings: row.all_meanings,
    contextSentence: row.context_sentence,
    sentenceTranslation: row.sentence_translation || ensureSentenceTranslation(row) || '',
    candidateSentences: row.candidate_sentences,
    sourceMemo: row.source_memo,
    bookTitle: row.book_title,
    quizCount: row.quiz_count,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    consecutiveCorrect: row.consecutive_correct,
    lastQuizDate: row.last_quiz_date || undefined,
    date: today,
    user_id: userId,
  }));

  const storageKey = getUserStorageKey(userId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify(formatted));
    localStorage.setItem(`context_vocab_seeded_${userId}`, 'true');
  }

  return formatted;
}

/**
 * 초기 샘플로 리셋 (게스트 및 로그인 사용자 계정 모두 지원)
 */
export async function resetWithSamples(userId?: string): Promise<VocabItem[]> {
  if (userId) {
    if (checkIsSupabaseConfigured() && supabase) {
      try {
        await supabase.from('vocab_words').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('Supabase clear before reset error:', e);
      }
    }
    const samples = await loadSamplesForUser(userId);
    if (typeof window !== 'undefined') {
      const storageKey = getUserStorageKey(userId);
      localStorage.setItem(storageKey, JSON.stringify(samples));
    }
    return samples;
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('context_vocab_guest_cleared');
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLES));
  }
  return INITIAL_SAMPLES;
}

/**
 * 단어장 전체 삭제 (로그인 사용자 및 게스트 지원)
 */
export async function clearAllVocab(userId?: string): Promise<void> {
  const storageKey = getUserStorageKey(userId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify([]));
    if (userId) {
      localStorage.setItem(`context_vocab_seeded_${userId}`, 'true');
    } else {
      localStorage.setItem('context_vocab_guest_cleared', 'true');
    }
  }
  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      await supabase.from('vocab_words').delete().eq('user_id', userId);
    } catch (e) {
      console.warn('Supabase clear error:', e);
    }
  }
}

