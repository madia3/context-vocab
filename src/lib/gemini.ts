// Gemini AI Vision OCR & Context Sentence Extractor

export const GEMINI_API_KEY_STORAGE = 'context_vocab_gemini_api_key';

export function getStoredGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
}

export function setStoredGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (!trimmed) {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  } else {
    localStorage.setItem(GEMINI_API_KEY_STORAGE, trimmed);
  }
}

// 이미지 파일을 base64 문자열로 변환
export function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeMatch = header.match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// AI Vision으로 책 페이지 문장 고정밀 인식 (오타 자동 수정 및 문장 단위 정제)
export async function extractTextWithAI(
  file: File | Blob,
  customApiKey?: string
): Promise<{ text: string; method: 'gemini' | 'tesseract' }> {
  const apiKey = customApiKey || getStoredGeminiKey();

  const { base64, mimeType } = await fileToBase64(file);

  try {
    const res = await fetch('/api/ai/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
      },
      body: JSON.stringify({ base64, mimeType }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text && data.text.trim()) {
        return { text: data.text.trim(), method: 'gemini' };
      }
    }
  } catch (err) {
    console.warn('AI Vision OCR 호출 실패, 로컬 Tesseract로 자동 전환합니다:', err);
  }

  // AI 실패 또는 키 미등록 시 Tesseract fallback
  const { extractTextFromPageImage } = await import('./ocr');
  const fallbackText = await extractTextFromPageImage(file);
  return { text: fallbackText, method: 'tesseract' };
}

export interface MatchedSentenceItem {
  sentence: string;
  matchedWord?: string;
}

// AI로 단어의 원형/복수형/시제 변화형을 문맥에서 파악하여 해당 원문 문장(복수 문장 포함) 및 최적의 문맥 뜻 적출
export async function findSentenceWithAI(
  pageText: string,
  word: string,
  customApiKey?: string,
  meanings?: { pos: string; def: string }[]
): Promise<{
  found: boolean;
  sentence: string;
  matchedWord?: string;
  allMatches: MatchedSentenceItem[];
  method: 'gemini' | 'rule';
  bestMeaningIndex?: number;
  bestMeaningDef?: string;
  bestPos?: string;
  aiExplanation?: string;
}> {
  const apiKey = customApiKey || getStoredGeminiKey();

  try {
    const res = await fetch('/api/ai/match-sentence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
      },
      body: JSON.stringify({ pageText, word, meanings }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.found && data.sentence) {
        const matches: MatchedSentenceItem[] =
          Array.isArray(data.allMatches) && data.allMatches.length > 0
            ? data.allMatches.map((m: any) => ({
                sentence: (m.sentence || '').trim(),
                matchedWord: m.matchedWord,
              })).filter((m: MatchedSentenceItem) => m.sentence.length > 0)
            : [{ sentence: data.sentence.trim(), matchedWord: data.matchedWord }];

        return {
          found: true,
          sentence: data.sentence.trim(),
          matchedWord: data.matchedWord,
          allMatches: matches,
          method: 'gemini',
          bestMeaningIndex: typeof data.bestMeaningIndex === 'number' ? data.bestMeaningIndex : undefined,
          bestMeaningDef: data.bestMeaningDef,
          bestPos: data.bestPos,
          aiExplanation: data.aiExplanation,
        };
      }
    }
  } catch (err) {
    console.warn('AI 문장 탐색 실패, 스마트 형태소 규칙으로 자동 전환합니다:', err);
  }

  // AI 키 미등록 또는 오류 시 규칙 기반 스마트 형태소 검색 fallback
  const { findAllSentencesWithWordSmart } = await import('./ocr');
  const all = findAllSentencesWithWordSmart(pageText, word);
  return {
    found: all.length > 0,
    sentence: all.length > 0 ? all[0].sentence : '',
    matchedWord: all.length > 0 ? all[0].matchedWord : undefined,
    allMatches: all,
    method: 'rule',
  };
}
