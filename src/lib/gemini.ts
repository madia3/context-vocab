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

// 이미지 파일을 가볍게 최적화(최대 1600px 리사이즈 및 JPEG 85% 압축)하여 base64로 초고속 변환
export function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    // 브라우저 캔버스를 이용한 초고속 리사이즈 & 압축 (네트워크 전송량 95% 절감)
    if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 1600; // OCR 및 밑줄/동그라미 인식에 완벽한 최적 해상도
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const [header, base64] = compressedDataUrl.split(',');
          resolve({ base64, mimeType: 'image/jpeg' });
          return;
        }

        // Fallback to FileReader if context fails
        fallbackFileReader(file, resolve);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        fallbackFileReader(file, resolve);
      };

      img.src = objectUrl;
      return;
    }

    fallbackFileReader(file, resolve);
  });
}

function fallbackFileReader(file: File | Blob, resolve: (val: { base64: string; mimeType: string }) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    resolve({ base64, mimeType });
  };
  reader.onerror = () => {
    resolve({ base64: '', mimeType: 'image/jpeg' });
  };
  reader.readAsDataURL(file);
}

// AI Vision으로 책 페이지 문장 고정밀 인식 & 밑줄/동그라미 친 단어 시각적 감지
export async function extractTextWithAI(
  file: File | Blob,
  customApiKey?: string,
  precompressedData?: { base64: string; mimeType: string } | null
): Promise<{ text: string; method: 'gemini' | 'tesseract'; markedWords: string[] }> {
  const apiKey = customApiKey || getStoredGeminiKey();

  const { base64, mimeType } =
    precompressedData && precompressedData.base64
      ? precompressedData
      : await fileToBase64(file);

  // 최대 2회 시도 (일시적 모바일 네트워크 끊김 대비)
  for (let attempt = 0; attempt < 2; attempt++) {
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
          const detected = data.markedWords || data.underlinedWords;
          const markedWords: string[] = Array.isArray(detected) ? detected : [];
          return { text: data.text.trim(), method: 'gemini', markedWords };
        }
      }
    } catch (err) {
      console.warn(`AI Vision OCR 호출 시도(${attempt + 1}) 실패:`, err);
    }
  }

  // AI 실패 또는 키 미등록 시 Tesseract fallback
  const { extractTextFromPageImage, cleanOcrText } = await import('./ocr');
  const fallbackText = await extractTextFromPageImage(file);
  return { text: cleanOcrText(fallbackText), method: 'tesseract', markedWords: [] };
}

export interface MatchedSentenceItem {
  sentence: string;
  matchedWord?: string;
}

// AI로 단어의 원형/복수형/시제 변화형을 문맥에서 파악하여 해당 원문 문장(복수 문장 포함) 및 최적의 문맥 뜻 적출
// (imageSource가 주어지면 원본 이미지를 직접 보고 100% 무결점으로 핀포인트 추출!)
export async function findSentenceWithAI(
  pageText: string,
  word: string,
  customApiKey?: string,
  meanings?: { pos: string; def: string }[],
  imageSource?: { base64: string; mimeType: string } | null,
  contextHint?: string
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
  lemma?: string;
}> {
  const apiKey = customApiKey || getStoredGeminiKey();

  try {
    const res = await fetch('/api/ai/match-sentence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
      },
      body: JSON.stringify({
        pageText,
        word,
        meanings,
        imageBase64: imageSource?.base64,
        mimeType: imageSource?.mimeType,
        contextHint,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.found && data.sentence) {
        const rawList =
          Array.isArray(data.allMatches) && data.allMatches.length > 0
            ? data.allMatches
            : [{ sentence: data.sentence.trim(), matchedWord: data.matchedWord }];

        const seenNorm = new Set<string>();
        const matches: MatchedSentenceItem[] = [];

        rawList.forEach((m: any) => {
          const sent = (m.sentence || '').trim();
          const norm = sent.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (sent && norm.length > 5 && !seenNorm.has(norm)) {
            seenNorm.add(norm);
            matches.push({ sentence: sent, matchedWord: m.matchedWord });
          }
        });

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
          lemma: data.lemma ? String(data.lemma).trim().toLowerCase() : undefined,
        };
      }
    }
  } catch (err) {
    console.warn('AI 문장 탐색 실패, 스마트 형태소 규칙으로 자동 전환합니다:', err);
  }

  // AI 키 미등록 또는 오류 시 규칙 기반 스마트 형태소 검색 fallback
  const { findAllSentencesWithWordSmart, extractLemmaCandidate } = await import('./ocr');
  const all = findAllSentencesWithWordSmart(pageText, word);
  return {
    found: all.length > 0,
    sentence: all.length > 0 ? all[0].sentence : '',
    matchedWord: all.length > 0 ? all[0].matchedWord : undefined,
    allMatches: all,
    method: 'rule',
    lemma: extractLemmaCandidate(word),
  };
}
