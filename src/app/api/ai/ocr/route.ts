import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/geminiServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { base64, mimeType, fallbackRawText } = await req.json();

    const hasImage = Boolean(base64 && typeof base64 === 'string' && base64.length > 50);
    const hasFallbackText = Boolean(fallbackRawText && typeof fallbackRawText === 'string' && fallbackRawText.trim().length > 5);

    if (!hasImage && !hasFallbackText) {
      return NextResponse.json({ error: 'Image base64 data or fallbackRawText is required' }, { status: 400 });
    }

    if (hasImage && base64.length > 12_000_000) {
      return NextResponse.json({ error: 'Image payload too large' }, { status: 413 });
    }

    const apiKey =
      req.headers.get('x-gemini-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key is not configured', code: 'NO_API_KEY' },
        { status: 401 }
      );
    }

    // 1. 원본 이미지가 있는 경우: 초고속 Vision OCR (thinkingLevel: LOW / thinkingBudget: 0 적용)
    if (hasImage) {
      const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

      const visionPrompt = `You are a high-precision OCR and document analysis AI specializing in English books, news articles, and research reports.
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

      const visionRes = await callGeminiWithFallback({
        apiKey,
        parts: [
          { text: visionPrompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
        ],
        temperature: 0.0,
        responseMimeType: 'application/json',
        candidates: [
          { model: 'gemini-3.5-flash-lite', thinkingConfig: { thinkingLevel: 'LOW' }, timeoutMs: 4800 },
          { model: 'gemini-3.1-flash-lite', thinkingConfig: { thinkingBudget: 0 }, timeoutMs: 4000 },
          { model: 'gemini-flash-lite-latest', thinkingConfig: { thinkingLevel: 'LOW' }, timeoutMs: 4000 },
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

    return NextResponse.json(
      { error: 'Gemini OCR API request failed' },
      { status: 502 }
    );
  } catch (err: any) {
    console.error('OCR API Route Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
