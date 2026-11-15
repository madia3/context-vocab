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

// 본문 텍스트를 개별 문장 배열로 분리
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // 마침표, 물음표, 느낌표 기준 분리
  const rawSentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return rawSentences
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

// 특정 단어가 포함된 원문 문장을 본문에서 자동 탐색
export function findSentenceWithWord(fullText: string, word: string): string | null {
  if (!fullText || !word) return null;

  const sentences = splitIntoSentences(fullText);
  const cleanWord = word.trim().toLowerCase();

  // 1순위: 정확한 단어 경계 매칭 (\bword[a-z]*\b - 복수형, 과거형 등 포함)
  const regex = new RegExp(`\\b${cleanWord}[a-z]*\\b`, 'i');

  for (const sentence of sentences) {
    if (regex.test(sentence)) {
      return sentence;
    }
  }

  // 2순위: 부분 포함 매칭
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(cleanWord)) {
      return sentence;
    }
  }

  return null;
}
