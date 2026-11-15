import Tesseract from 'tesseract.js';

// 영어 원서 페이지 이미지에서 텍스트를 고정밀 추출
export async function extractTextFromPageImage(
  imageFile: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const result = await Tesseract.recognize(imageFile, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const raw = result.data.text || '';
    // 줄바꿈이 문장 중간에 잘린 것 정리
    const cleaned = cleanOcrText(raw);
    return cleaned;
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}

// OCR 텍스트 정제 (개행을 공백으로 합치되 문단 구분은 유지)
export function cleanOcrText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/([a-zA-Z0-9,;])\n([a-zA-Z0-9])/g, '$1 $2') // 단어 중간 개행 연결
    .replace(/\s+/g, ' ')
    .trim();
}

// 불규칙 동사/명사 및 어형 변화 사전
const COMMON_IRREGULARS: Record<string, string[]> = {
  child: ['children'],
  man: ['men'],
  woman: ['women'],
  person: ['people', 'persons'],
  foot: ['feet'],
  tooth: ['teeth'],
  mouse: ['mice'],
  go: ['goes', 'went', 'gone', 'going'],
  do: ['does', 'did', 'done', 'doing'],
  see: ['sees', 'saw', 'seen', 'seeing'],
  run: ['runs', 'ran', 'running'],
  take: ['takes', 'took', 'taken', 'taking'],
  get: ['gets', 'got', 'gotten', 'getting'],
  make: ['makes', 'made', 'making'],
  know: ['knows', 'knew', 'known', 'knowing'],
  think: ['thinks', 'thought', 'thinking'],
  come: ['comes', 'came', 'coming'],
  give: ['gives', 'gave', 'given', 'giving'],
  find: ['finds', 'found', 'finding'],
  tell: ['tells', 'told', 'telling'],
  feel: ['feels', 'felt', 'feeling'],
  leave: ['leaves', 'left', 'leaving'],
  write: ['writes', 'wrote', 'written', 'writing'],
  read: ['reads', 'reading'],
  speak: ['speaks', 'spoke', 'spoken', 'speaking'],
  bring: ['brings', 'brought', 'bringing'],
  begin: ['begins', 'began', 'begun', 'beginning'],
};

// 단어의 다양한 변화형(복수형, 시제, 분사형, 파생형) 생성
export function generateWordVariants(baseWord: string): string[] {
  const w = baseWord.trim().toLowerCase();
  if (!w) return [];

  const set = new Set<string>();
  set.add(w);

  // 불규칙 매핑 확인
  if (COMMON_IRREGULARS[w]) {
    COMMON_IRREGULARS[w].forEach((v) => set.add(v));
  }
  // 역방향 불규칙 매핑 (예: ran 검색 시 run 추가)
  for (const [root, variants] of Object.entries(COMMON_IRREGULARS)) {
    if (variants.includes(w)) {
      set.add(root);
      variants.forEach((v) => set.add(v));
    }
  }

  // 규칙적 변화형 생성
  // 1) 복수형 / 3인칭 단수: -s, -es, -ies
  if (w.endsWith('y') && !/[aeiou]y$/.test(w)) {
    set.add(w.slice(0, -1) + 'ies'); // party -> parties
    set.add(w.slice(0, -1) + 'ied'); // try -> tried
    set.add(w + 'ing'); // try -> trying
  } else if (w.endsWith('s') || w.endsWith('sh') || w.endsWith('ch') || w.endsWith('x') || w.endsWith('z')) {
    set.add(w + 'es');
  } else {
    set.add(w + 's');
  }

  // 2) 과거형 / 과거분사: -ed, -d
  if (w.endsWith('e')) {
    set.add(w + 'd'); // love -> loved
    set.add(w.slice(0, -1) + 'ing'); // love -> loving
  } else {
    set.add(w + 'ed');
    set.add(w + 'ing');
    // 단모음+단자음 자음 중복 (stop -> stopped, run -> running)
    if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(w) && w.length >= 3) {
      const lastChar = w[w.length - 1];
      set.add(w + lastChar + 'ed');
      set.add(w + lastChar + 'ing');
    }
  }

  // 3) 형용사/부사/명사 파생형
  set.add(w + 'al'); // tradition -> traditional
  set.add(w + 'ly'); // traditional -> traditionally, quick -> quickly
  set.add(w + 'tion');
  set.add(w + 'ness');

  return Array.from(set);
}

// 본문 텍스트를 개별 문장 배열로 정교하게 분리 (약어 Mr., e.g., i.e. 보존 및 따옴표 처리)
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // 1. 단어 중간 하이픈 줄바꿈 복구 (예: tra- dition -> tradition)
  let normalized = text
    .replace(/([a-zA-Z]+)-\s*\n\s*([a-zA-Z]+)/g, '$1$2')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ');

  // 2. 자주 나오는 영어 약어(Mr., Mrs., Dr., etc., e.g., i.e., vs.)의 온점 임시 치환
  normalized = normalized
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Gen|Rep|Sen|St|etc|e\.g|i\.e|vs)\./gi, '$1{{DOT}}')
    .replace(/(\d+)\.(\d+)/g, '$1{{DOT}}$2'); // 소수점 보호

  // 3. 문장 종결 부호(. ! ?) 뒤 공백 또는 따옴표 분리
  const rawParts = normalized.split(/(?<=[.!?]["'”’]?)\s+(?=[A-Z0-9"“'‘])/);

  return rawParts
    .map((s) => s.replace(/\{\{DOT\}\}/g, '.').trim())
    .filter((s) => s.length > 5);
}

// 특정 단어가 포함된 원문 문장을 형태소 규칙 기반으로 스마트 탐색
export function findSentenceWithWordSmart(
  fullText: string,
  word: string
): { sentence: string; matchedWord: string } | null {
  if (!fullText || !word) return null;

  const sentences = splitIntoSentences(fullText);
  const variants = generateWordVariants(word);

  // 1순위: 원형 및 변화형과 단어 경계(\b)가 완벽히 일치하는 문장 탐색
  for (const variant of variants) {
    const boundaryRegex = new RegExp(`\\b${variant}\\b`, 'i');
    for (const sentence of sentences) {
      if (boundaryRegex.test(sentence)) {
        return { sentence, matchedWord: variant };
      }
    }
  }

  // 2순위: 접두사 확장 형태 (\bword[a-z]*\b) 매칭
  const prefixRegex = new RegExp(`\\b${word.trim().toLowerCase()}[a-z]*\\b`, 'i');
  for (const sentence of sentences) {
    const match = sentence.match(prefixRegex);
    if (match) {
      return { sentence, matchedWord: match[0] };
    }
  }

  // 3순위: 단순 포함
  const lowerWord = word.trim().toLowerCase();
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(lowerWord)) {
      return { sentence, matchedWord: word };
    }
  }

  return null;
}

// 이전 버전 호환 함수
export function findSentenceWithWord(fullText: string, word: string): string | null {
  const res = findSentenceWithWordSmart(fullText, word);
  return res ? res.sentence : null;
}
