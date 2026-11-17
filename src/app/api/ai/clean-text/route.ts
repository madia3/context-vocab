import { NextRequest, NextResponse } from 'next/server';
import { cleanArticleTextHeuristic } from '@/lib/cleanText';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    // 1. 기본 휴리스틱 정제
    const heuristicResult = cleanArticleTextHeuristic(rawText);

    const apiKey =
      req.headers.get('x-gemini-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // AI 키가 없으면 휴리스틱 정제 결과 반환
    if (!apiKey) {
      return NextResponse.json({
        cleanedText: heuristicResult.cleanedText,
        removedCount: heuristicResult.removedCount,
        method: 'heuristic',
      });
    }

    // 2. Gemini AI 고정밀 광고 및 노이즈 정제
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are a professional news editor assistant.
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

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (parsed.cleanedText && parsed.cleanedText.trim().length > 20) {
          return NextResponse.json({
            cleanedText: parsed.cleanedText.trim(),
            title: parsed.title || '',
            removedCount: heuristicResult.removedCount || 1,
            notes: parsed.removedAdNotes || '',
            method: 'gemini',
          });
        }
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
