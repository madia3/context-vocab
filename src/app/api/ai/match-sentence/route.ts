import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { pageText, word, meanings } = await req.json();

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

    const hasMeanings = Array.isArray(meanings) && meanings.length > 0;
    const meaningsText = hasMeanings
      ? meanings.map((m: any, idx: number) => `[${idx}] (${m.pos || '품사'}) ${m.def}`).join('\n')
      : 'None provided';

    const prompt = `You are a strict, precise English-Korean bilingual linguist and lexicographer.
Target Word: "${word}"

Page Text:
"""
${pageText}
"""

Available Korean Dictionary Definitions:
${meaningsText}

CRITICAL INSTRUCTIONS:
1. Determine if the target English vocabulary word "${word}" (or any of its direct grammatical inflections: e.g. "go" -> "went"/"gone"/"going", "decline" -> "declined"/"declining", "boost" -> "boosted"/"boosting"/"boosts") appears in the provided Page Text.
2. If "${word}" or its inflection does NOT appear in the page text, you MUST return:
{
  "found": false,
  "sentence": "",
  "matchedWord": "",
  "allMatches": [],
  "bestMeaningIndex": 0,
  "bestMeaningDef": "",
  "bestPos": "",
  "aiExplanation": ""
}
3. If it DOES appear:
   - Extract the EXACT complete sentence from the text containing the word.
   - Analyze how the word is used in that sentence grammatically and contextually.
   - From the Available Korean Dictionary Definitions above, pick the 0-based index that BEST fits this sentence's context.
   - If a specific definition matches best, set "bestMeaningIndex" to its index, "bestMeaningDef" to its definition text, and "bestPos" to its part of speech.
   - Provide a concise 1-sentence Korean explanation why this meaning fits the context in "aiExplanation".

Return ONLY valid JSON:
{
  "found": true,
  "sentence": "Exact complete sentence from text",
  "matchedWord": "the exact word form found",
  "allMatches": [
    { "sentence": "Exact complete sentence 1", "matchedWord": "form1" }
  ],
  "bestMeaningIndex": 0,
  "bestMeaningDef": "가장 적절한 한국어 뜻",
  "bestPos": "v. / n. / adj.",
  "aiExplanation": "이 문장에서는 ~라는 의미로 쓰였습니다."
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
