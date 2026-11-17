import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { pageText, word } = await req.json();

    if (!pageText || !word) {
      return NextResponse.json({ error: 'pageText and word are required' }, { status: 400 });
    }

    const apiKey =
      req.headers.get('x-gemini-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key is not configured' },
        { status: 401 }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are a strict, precise English linguist assistant.
Your task is to determine whether the target English vocabulary word "${word}" (or any of its direct grammatical inflections: e.g. "go" -> "went"/"gone"/"going"/"goes", "decline" -> "declined"/"declining"/"declines", "prevalent" -> "prevalent") appears in the provided text.

Target Word: "${word}"

Page Text:
"""
${pageText}
"""

CRITICAL INSTRUCTIONS:
1. ONLY match sentences that LITERALLY contain "${word}" or its direct grammatical verb/noun/adjective inflection in the text.
2. NEVER match completely different or unrelated words (for example, NEVER match "decline" if target word is "went").
3. If "${word}" or its inflection does NOT appear in the page text, you MUST return:
{"found": false, "sentence": "", "matchedWord": "", "allMatches": []}

4. If it DOES appear, return ONLY valid JSON:
{
  "found": true,
  "sentence": "Exact complete sentence from text",
  "matchedWord": "the exact word form found",
  "allMatches": [
    { "sentence": "Exact complete sentence 1", "matchedWord": "form1" }
  ]
}`;

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
          temperature: 0.0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini Match Sentence Error:', geminiRes.status, errBody);
      return NextResponse.json(
        { error: 'Gemini API request failed', details: errBody },
        { status: geminiRes.status }
      );
    }

    const data = await geminiRes.json();
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    try {
      const parsed = JSON.parse(rawJsonText);
      // 철저한 환각 검증: 반환된 문장 또는 본문에 실제로 단어나 형태소가 존재하는지 확인
      if (parsed.found && parsed.sentence) {
        const sentenceLower = String(parsed.sentence).toLowerCase();
        const wordLower = word.toLowerCase();
        const matchedLower = String(parsed.matchedWord || '').toLowerCase();

        // 문장 안에 targetWord 또는 matchedWord가 최소한 포함되어 있어야 유효!
        const isValid =
          sentenceLower.includes(wordLower) ||
          (matchedLower && sentenceLower.includes(matchedLower));

        if (!isValid) {
          console.warn(`AI Hallucination blocked: "${word}" matched unrelated sentence: "${parsed.sentence}"`);
          return NextResponse.json({ found: false, sentence: '', matchedWord: '', allMatches: [] });
        }
      }
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ found: false, sentence: '', matchedWord: '', allMatches: [] });
    }
  } catch (err: any) {
    console.error('Match Sentence API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
