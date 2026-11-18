import { NextRequest, NextResponse } from 'next/server';
import { cleanArticleTextHeuristic } from '@/lib/cleanText';
import { cleanOcrText } from '@/lib/ocr';
import { callGeminiWithFallback, checkRateLimit, resolveServerGeminiKey } from '@/lib/geminiServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 30);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      );
    }

    const { rawText, mode } = await req.json();

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    const isOcrRepair = mode === 'ocr_repair';
    const heuristicResult = isOcrRepair
      ? { cleanedText: cleanOcrText(rawText), removedCount: 1 }
      : cleanArticleTextHeuristic(rawText);

    const apiKey = resolveServerGeminiKey(req);

    // AI 키가 없으면 휴리스틱 정제 결과 반환
    if (!apiKey) {
      return NextResponse.json({
        cleanedText: heuristicResult.cleanedText,
        removedCount: heuristicResult.removedCount,
        method: 'heuristic',
      });
    }

    const prompt = isOcrRepair
      ? `You are an expert English book and article OCR restoration AI.
The following text was extracted by noisy local OCR (Tesseract) from a photographed English book page.
It contains OCR garbage symbols (e.g. "== i & |", "SSN 5 5", "2 S == S 7. 1.", "0 || r", "ag", "Ting", "Sa a:") and corrupted or split words (e.g. "CATEGOR )Eg" -> "CATEGORIES.", "Jike" -> "like", "Bleue = Ee i 5 tions" -> "these questions", "pub - SS == b WR lishing" -> "publishing", "tar get" -> "target", "SOME IN COMMON" -> "SOMETHING IN COMMON").

TASK:
1. Reconstruct and restore the clean, natural, 100% accurate English book prose.
2. Remove all meaningless OCR symbol noise, random single-letter/number artifacts, and broken hyphenations.
3. Restore any garbled words to their exact contextually intended English words while faithfully preserving all original sentences and paragraphs.
4. Return ONLY valid JSON:
{
  "cleanedText": "The clean restored English book prose..."
}

Noisy OCR Text:
"""
${rawText.slice(0, 8000)}
"""`
      : `You are a professional news editor assistant.
The following English text was copied directly from a news article / web page (often paywalled or requiring login).
It may contain noisy elements such as:
- Banner/inline ads ("Advertisement", "Sponsored content", "Story continues below")
- Paywall/subscription prompts ("Subscribe to read the full story", "Create a free account", "Sign up for our newsletter")
- Navigation artifacts ("Share this article", "Follow us on Twitter", "Photo credit: ...", "Read next: ...")
- Footer legalese ("All rights reserved", "Copyright 2024", "Terms of Service")

TASK:
1. Strip away ALL advertisements, subscription prompts, social share calls, and promotional noise.
2. Keep ALL original article body sentences completely intact, maintaining original vocabulary, grammar, and paragraph coherence.
3. Detect a concise article title if one is present at the beginning (or generate a concise 3-6 word title).
4. Return ONLY valid JSON:
{
  "cleanedText": "The clean article body without any ads or promotional lines",
  "title": "Detected Article Title",
  "removedAdNotes": "Brief 1-sentence note of what ads/prompts were removed"
}

Original Text:
"""
${rawText.slice(0, 8000)}
"""`;

    const aiRes = await callGeminiWithFallback({
      apiKey,
      endpoint: 'clean-text',
      parts: [{ text: prompt }],
      temperature: 0.0,
      responseMimeType: 'application/json',
    });

    if (aiRes.ok && aiRes.text) {
      try {
        const cleanJson = aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        const cleaned = (parsed.cleanedText || parsed.text || '').trim();
        if (cleaned.length > 10) {
          return NextResponse.json({
            cleanedText: cleaned,
            title: parsed.title || '',
            removedCount: heuristicResult.removedCount || 1,
            notes: parsed.removedAdNotes || '',
            method: 'gemini',
            modelUsed: aiRes.modelUsed,
            serverDurationMs: aiRes.durationMs,
            attemptLogs: aiRes.attemptLogs || [],
          });
        }
      } catch (err) {
        console.warn('Clean text JSON parse fallback:', err);
      }
    }

    // Gemini 호출 실패 시 휴리스틱 정제 결과 반환
    return NextResponse.json({
      cleanedText: heuristicResult.cleanedText,
      removedCount: heuristicResult.removedCount,
      method: 'heuristic_fallback',
    });
  } catch (err: any) {
    console.error('Clean text error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
