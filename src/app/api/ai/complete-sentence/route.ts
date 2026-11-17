import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/geminiServer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { sentence, word } = await req.json();

    if (!sentence || typeof sentence !== 'string') {
      return NextResponse.json({ error: 'Sentence is required' }, { status: 400 });
    }

    const apiKey =
      req.headers.get('x-gemini-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 401 });
    }

    const prompt = `You are an expert English editor and lexicographer.
A reader took a photo of a book/article page, but the sentence was cut off across page boundaries or margin limits.

Incomplete Sentence Fragment:
"""
${sentence.trim()}
"""

Target Vocabulary Word: "${word || ''}"

TASK:
1. Complete the cut-off sentence naturally and grammatically, preserving the existing words as much as possible.
2. If the beginning was cut off (e.g. starts with lowercase or mid-clause), add a natural beginning clause.
3. If the end was cut off (e.g. ends abruptly without a period, or ends with a conjunction/preposition), complete the clause with a plausible, natural, elegant ending.
4. The target word "${word || ''}" must remain naturally inside the sentence.
5. Return ONLY a single complete English sentence ending with a proper period (.), question mark (?), or exclamation mark (!). Do NOT return quotes or explanations.`;

    const aiRes = await callGeminiWithFallback({
      apiKey,
      parts: [{ text: prompt }],
      temperature: 0.2,
      responseMimeType: 'text/plain',
      maxOutputTokens: 250,
    });

    let completedText = '';
    if (aiRes.ok && aiRes.text) {
      const cleaned = aiRes.text.replace(/^["'`]|["'`]$/g, '').trim();
      if (cleaned.length > 5) {
        completedText = cleaned;
      }
    }

    if (!completedText) {
      completedText = sentence.trim();
      if (!/[.!?]$/.test(completedText)) {
        completedText += '.';
      }
    }

    return NextResponse.json({ completedSentence: completedText });
  } catch (err: any) {
    console.error('Sentence completion error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to complete sentence' },
      { status: 500 }
    );
  }
}
