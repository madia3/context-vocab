import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, checkRateLimit, resolveServerGeminiKey } from '@/lib/geminiServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

function extractGeminiErrorMessage(rawError?: string): string {
  if (!rawError) return 'Gemini API 응답 없음';
  try {
    const parsed = JSON.parse(rawError);
    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {}
  if (rawError.includes('API_KEY_INVALID') || rawError.includes('API key not valid')) {
    return 'Gemini API 키가 유효하지 않습니다 (API_KEY_INVALID)';
  }
  if (rawError.includes('RESOURCE_EXHAUSTED')) {
    return 'Gemini API 요청 한도 초과 (RESOURCE_EXHAUSTED)';
  }
  if (rawError.includes('Timeout') || rawError.includes('aborted') || rawError.includes('abort')) {
    return '분석 시간 초과 (Vercel 타임아웃)';
  }
  return rawError.length > 80 ? `${rawError.slice(0, 80)}...` : rawError;
}

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 20);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      );
    }

    const { base64, mimeType, images, fallbackRawText } = await req.json();

    // 1장 또는 최대 2장(전후 페이지) 이미지 지원
    const imageList: { base64: string; mimeType?: string }[] = [];
    if (Array.isArray(images) && images.length > 0) {
      images.slice(0, 2).forEach((img: any) => {
        if (img?.base64 && typeof img.base64 === 'string' && img.base64.length > 50 && img.base64.length <= 12_000_000) {
          imageList.push({
            base64: img.base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
            mimeType: img.mimeType || 'image/jpeg',
          });
        }
      });
    } else if (base64 && typeof base64 === 'string' && base64.length > 50 && base64.length <= 12_000_000) {
      imageList.push({
        base64: base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
        mimeType: mimeType || 'image/jpeg',
      });
    }

    const hasImages = imageList.length > 0;
    const hasFallbackText = Boolean(fallbackRawText && typeof fallbackRawText === 'string' && fallbackRawText.trim().length > 5);

    if (!hasImages && !hasFallbackText) {
      return NextResponse.json({ error: 'Image base64 data or fallbackRawText is required' }, { status: 400 });
    }

    const apiKey = resolveServerGeminiKey(req);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key is not configured', code: 'NO_API_KEY' },
        { status: 401 }
      );
    }

    let visionLastError = '';

    // 1. 원본 이미지가 있는 경우: 초고속 Vision OCR (thinkingLevel: LOW / thinkingBudget: 0 적용)
    if (hasImages) {
      const isMultiPage = imageList.length > 1;

      const visionPrompt = isMultiPage
        ? `You are a high-precision OCR and document analysis AI for English books and articles.
You are given two consecutive photographed pages (or images) from a book.

Strict Rules:
1. DETERMINE PAGE READING ORDER:
   - Carefully inspect both images and determine their natural chronological reading order (which page comes first and which comes second).
   - Seamlessly connect any sentence or clause that is cut off across the page boundary (e.g. word hyphenations across pages, incomplete trailing sentences).

2. EXCLUDE CHARTS, GRAPHS, PLOTS & TABLES:
   - Completely IGNORE and DO NOT transcribe charts, bar graphs, plots, diagrams, axes numbers, and footnote citations.
   - Transcribe ONLY the readable reading prose sentences, paragraphs, and headings in proper sequential order.

3. DETECT CIRCLED OR UNDERLINED WORDS:
   - Identify any English words marked with handwritten underlines or circles in either image.
   - Accurately restore the clean original English word without pen marks into the "markedWords" array (e.g. ["categories", "grow"]).

Output strictly valid JSON:
{
  "text": "Clean combined transcribed article/prose text across both pages in chronological reading order...",
  "markedWords": ["word1", "word2"]
}`
        : `You are a high-precision OCR and document analysis AI specializing in English books, news articles, and research reports.
Carefully inspect the provided image.

Strict Rules:
1. EXCLUDE CHARTS, GRAPHS, PLOTS & TABLES:
   - Completely IGNORE and DO NOT transcribe any charts, bar graphs, plots, diagrams, percentages or years along graph axes (e.g. "40% 30% 20% 0% -20%", "1990 1995 2000 2025"), tick marks, legends, and footnote citations like "Source: Datastream, Goldman Sachs".
   - Transcribe ONLY the readable reading prose sentences, paragraphs, and article headings.
   - Fix all hyphenated word breaks across lines (e.g. "con- / dition" -> "condition", "pub- / lishing" -> "publishing") and OCR typos.

2. DETECT CIRCLED OR UNDERLINED WORDS (VERY IMPORTANT):
   - Readers often mark words with a pen or pencil. Identify any English words that have a HANDWRITTEN UNDERLINE, a CIRCLE, or an OVAL around or under them (for example, in the image: "earnings" is underlined, "grow" is circled, "categories" is circled).
   - Accurately restore the clean original English word, ignoring the pen marks (e.g. recognize "grow", NOT "tcGrow)1"; recognize "categories", NOT "CATEGOR )Eg").
   - Put all such marked words into the "markedWords" array as clean lowercase words (e.g. ["earnings", "grow"]).
   - If there are no underlines or circles, return an empty array [].

Output strictly valid JSON in this exact structure without markdown backticks:
{
  "text": "Clean transcribed article/prose text without any charts or graphs...",
  "markedWords": ["word1", "word2"]
}`;

      const contentParts: any[] = [{ text: visionPrompt }];
      imageList.forEach((img) => {
        contentParts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.base64,
          },
        });
      });

      const visionRes = await callGeminiWithFallback({
        apiKey,
        endpoint: 'ocr-vision',
        parts: contentParts,
        temperature: 0.0,
        responseMimeType: 'application/json',
        candidates: [
          { model: 'gemini-3.8-flash', thinkingConfig: { thinkingBudget: 0 }, timeoutMs: 8500 },
          { model: 'gemini-2.5-flash', thinkingConfig: { thinkingBudget: 0 }, timeoutMs: 8500 },
          { model: 'gemini-3.5-flash-lite', timeoutMs: 7000 },
          { model: 'gemini-1.5-flash', timeoutMs: 8500 },
        ],
      });

      if (visionRes.ok && visionRes.text) {
        let text = visionRes.text;
        let markedWords: string[] = [];

        try {
          const cleanJson = visionRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (typeof parsed.text === 'string' && parsed.text.trim()) {
            text = parsed.text.trim();
          }
          const detected = parsed.markedWords || parsed.underlinedWords;
          if (Array.isArray(detected)) {
            markedWords = detected
              .map((w: any) => String(w || '').trim().toLowerCase().replace(/[^a-zA-Z'-]/g, ''))
              .filter((w: string) => w.length >= 2);
          }
        } catch {
          text = visionRes.text.trim();
        }

        if (text) {
          return NextResponse.json({ text, markedWords, method: 'vision' });
        }
      } else {
        visionLastError = visionRes.lastError || '';
      }
    }

    // 2. 만약 Vision 호출이 타임아웃/실패했거나 텍스트만 전달된 경우: 초고속(1.5초) AI 텍스트 문맥 복원 엔진 가동
    if (hasFallbackText) {
      const repairPrompt = `You are an expert English book and article OCR restoration AI.
The following text was extracted by noisy local OCR (Tesseract) from a photographed English book page.
It contains OCR garbage symbols (e.g. "== i & |", "SSN 5 5", "2 S == S 7. 1.", "0 || r", "ag", "Ting", "Sa a:") and corrupted or split words (e.g. "CATEGOR )Eg" -> "CATEGORIES.", "Jike" -> "like", "Bleue = Ee i 5 tions" -> "these questions", "pub - SS == b WR lishing" -> "publishing", "tar get" -> "target", "SOME IN COMMON" -> "SOMETHING IN COMMON").

TASK:
1. Reconstruct and restore the clean, natural, 100% accurate English book prose.
2. Remove all meaningless OCR symbol noise, random single-letter/number artifacts, and broken hyphenations.
3. Restore any garbled words to their exact contextually intended English words while faithfully preserving all original sentences and paragraphs.
4. Return ONLY valid JSON:
{
  "text": "Clean restored English book text..."
}

Noisy OCR Text:
"""
${String(fallbackRawText).slice(0, 6000)}
"""`;

      const textRes = await callGeminiWithFallback({
        apiKey,
        endpoint: 'ocr-text-repair',
        parts: [{ text: repairPrompt }],
        temperature: 0.0,
        responseMimeType: 'application/json',
      });

      if (textRes.ok && textRes.text) {
        try {
          const cleanJson = textRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          const restored = (parsed.text || parsed.cleanedText || '').trim();
          if (restored.length > 10) {
            return NextResponse.json({ text: restored, markedWords: [], method: 'text_repair' });
          }
        } catch {
          const rawTrimmed = textRes.text.trim();
          if (rawTrimmed.length > 10) {
            return NextResponse.json({ text: rawTrimmed, markedWords: [], method: 'text_repair' });
          }
        }
      }
    }

    const finalErrMsg = extractGeminiErrorMessage(visionLastError || 'Gemini Vision 호출 실패');
    return NextResponse.json(
      { error: finalErrMsg },
      { status: 502 }
    );
  } catch (err: any) {
    console.error('OCR API Route Error:', err);
    return NextResponse.json(
      { error: extractGeminiErrorMessage(err.message || 'Internal server error') },
      { status: 500 }
    );
  }
}
