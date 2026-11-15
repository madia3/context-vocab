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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are an expert English linguist and vocabulary reading assistant.
Given the target English vocabulary word and the book page text below, identify ALL complete sentences where this vocabulary word (or any of its inflected/derived forms, such as plural noun, past tense, present participle, singular, adverb, or comparative/superlative form; e.g. "party" -> "parties", "walk" -> "walked"/"walking", "prevalent" -> "prevalent") is used.

Target Word: "${word}"

Page Text:
"""
${pageText}
"""

Instructions:
1. Find all distinct complete English sentences in the text where this word or its variant appears.
2. If multiple sentences contain the word, include all of them in the "allMatches" array, and set "sentence" to the first/most representative one.
3. Return ONLY a valid JSON object in the following format with NO markdown fences, NO preamble, and NO extra text:
{
  "found": true,
  "sentence": "First or most representative complete sentence",
  "matchedWord": "the exact word form found",
  "allMatches": [
    { "sentence": "Complete exact sentence 1", "matchedWord": "form1" },
    { "sentence": "Complete exact sentence 2", "matchedWord": "form2" }
  ]
}
If the word or any of its forms does NOT appear anywhere in the text, return:
{"found": false, "sentence": "", "matchedWord": "", "allMatches": []}`;

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
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ found: false, sentence: '', matchedWord: '' });
    }
  } catch (err: any) {
    console.error('Match Sentence API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
