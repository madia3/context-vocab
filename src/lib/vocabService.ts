import { VocabItem } from '@/types/vocab';
import { supabase, checkIsSupabaseConfigured, getCurrentUser } from './supabase';
import { User } from '@supabase/supabase-js';

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

/**
 * 단어 목록을 가져옵니다.
 * - 로그인된 유저가 있으면: Supabase에서 user_id로 격리된 단어를 가져오며, 사용자 로컬 캐시에 동기화
 * - 비로그인(게스트) 상태면: 게스트용 로컬 스토리지 또는 샘플 단어 반환
 */
export async function fetchVocabulary(targetUser?: User | null): Promise<VocabItem[]> {
  const isConfigured = checkIsSupabaseConfigured();
  const user = targetUser !== undefined ? targetUser : await getCurrentUser();
  const storageKey = getUserStorageKey(user?.id);

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
        // 신규 유저 초기 세팅: 저장된 단어가 0개인 경우 초기 3개 단어장(30단어) 자동 세팅
        if (data.length === 0) {
          const seededKey = `context_vocab_seeded_${user.id}`;
          const isSeeded = typeof window !== 'undefined' ? localStorage.getItem(seededKey) : null;
          if (!isSeeded) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(seededKey, 'true');
            }
            const seeded = await loadSamplesForUser(user.id);
            if (seeded && seeded.length > 0) {
              return seeded;
            }
          }
        }

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
          // 로컬 캐시와 병합하여 최신 상태 유지
          const localStr = localStorage.getItem(storageKey);
          let localItems: VocabItem[] = [];
          if (localStr) {
            try {
              localItems = JSON.parse(localStr);
            } catch {}
          }
          const serverIds = new Set(formatted.map((f) => f.id));
          const unsynced = localItems.filter((l) => !serverIds.has(l.id));
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
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            bookTitle: item.bookTitle || item.sourceMemo || '기본 단어장',
            quizCount: item.quizCount || 0,
            correctCount: item.correctCount || 0,
            wrongCount: item.wrongCount || 0,
            consecutiveCorrect: item.consecutiveCorrect || 0,
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 게스트 첫 방문 시 샘플 단어 제공
    if (!user) {
      const hasVisited = localStorage.getItem('context_vocab_visited');
      if (!hasVisited) {
        localStorage.setItem('context_vocab_visited', 'true');
        localStorage.setItem(storageKey, JSON.stringify(INITIAL_SAMPLES));
        return INITIAL_SAMPLES;
      }
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

  // Supabase 동기화 (로그인된 사용자가 있을 때만 실행)
  if (checkIsSupabaseConfigured() && supabase && userId) {
    try {
      const { error } = await supabase.from('vocab_words').insert({
        id: normalizedItem.id,
        user_id: userId,
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
 * 단어를 추가하거나, 이미 등록된 단어인 경우 관련 원문 문장(candidateSentences)을 누적 병합합니다.
 */
export async function saveOrMergeVocabularyItem(
  item: VocabItem,
  userId?: string
): Promise<{ isMerged: boolean; item: VocabItem; totalSentences: number }> {
  const targetWord = item.word.trim().toLowerCase();
  const storageKey = getUserStorageKey(userId);

  let existingItem: VocabItem | null = null;
  let currentList: VocabItem[] = [];

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        currentList = JSON.parse(local);
        // 동일 단어(대소문자 무관) 탐색
        existingItem = currentList.find(
          (v) => v.word.trim().toLowerCase() === targetWord
        ) || null;
      } catch {}
    }
  }

  // 1. 이미 등록되어 있는 단어인 경우 -> 관련 문장 누적 병합!
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
      candidateSentences: mergedSentences,
      sourceMemo: mergedMemo,
      allMeanings: mergedMeanings,
      selectedMeaning: item.selectedMeaning || existingItem.selectedMeaning,
      partOfSpeech: item.partOfSpeech || existingItem.partOfSpeech,
      bookTitle: item.bookTitle || existingItem.bookTitle,
    };

    // 로컬 스토리지 업데이트
    if (typeof window !== 'undefined') {
      const updatedList = currentList.map((v) => (v.id === existingItem!.id ? mergedItem : v));
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    }

    // Supabase 업데이트 (로그인된 사용자가 있을 때만 실행)
    if (checkIsSupabaseConfigured() && supabase && userId) {
      try {
        await supabase
          .from('vocab_words')
          .update({
            context_sentence: mergedItem.contextSentence,
            candidate_sentences: mergedItem.candidateSentences,
            source_memo: mergedItem.sourceMemo,
            all_meanings: mergedItem.allMeanings,
            selected_meaning: mergedItem.selectedMeaning,
            part_of_speech: mergedItem.partOfSpeech,
          })
          .eq('id', mergedItem.id)
          .eq('user_id', userId);
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
  await addVocabularyItem(item, userId);
  return {
    isMerged: false,
    item,
    totalSentences: (item.candidateSentences?.length || 1),
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

  // Supabase 동기화
  if (checkIsSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('vocab_words')
        .update({ book_title: normalizedTarget });

      if (sourceBook === '기본 단어장') {
        query = query.or('book_title.eq.기본 단어장,book_title.is.null');
      } else {
        query = query.eq('book_title', sourceBook);
      }

      if (userId) {
        query = query.eq('user_id', userId);
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

  // Supabase 동기화
  if (checkIsSupabaseConfigured() && supabase) {
    try {
      let query = supabase.from('vocab_words').delete();

      if (bookTitle === '기본 단어장') {
        query = query.or('book_title.eq.기본 단어장,book_title.is.null');
      } else {
        query = query.eq('book_title', bookTitle);
      }

      if (userId) {
        query = query.eq('user_id', userId);
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
        console.warn('loadSamplesForUser supabase upsert error:', error);
      }
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
  }

  return formatted;
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
