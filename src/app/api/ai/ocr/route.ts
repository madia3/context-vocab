import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { base64, mimeType } = await req.json();

    if (!base64) {
      return NextResponse.json({ error: 'Image base64 data is required' }, { status: 400 });
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

    // Google Gemini REST API 호출
    const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are a high-precision OCR and document analysis AI specializing in English books, news articles, and research reports.
Carefully inspect the provided image.

Strict Rules:
1. EXCLUDE CHARTS, GRAPHS, PLOTS & TABLES:
   - Completely IGNORE and DO NOT transcribe any charts, bar graphs, plots, diagrams, percentages or years along graph axes (e.g. "40% 30% 20% 0% -20%", "1990 1995 2000 2025"), tick marks, legends, and footnote citations like "Source: Datastream, Goldman Sachs".
   - Transcribe ONLY the readable reading prose sentences, paragraphs, and article headings.
   - Fix all hyphenated word breaks across lines (e.g. "con- / dition" -> "condition") and OCR typos.

2. DETECT CIRCLED OR UNDERLINED WORDS (VERY IMPORTANT):
   - Readers often mark words with a pen or pencil. Identify any English words that have a HANDWRITTEN UNDERLINE, a CIRCLE, or an OVAL around or under them (for example, in the image: "earnings" is underlined, "grow" is circled).
   - Accurately restore the clean original English word, ignoring the pen marks (e.g. recognize "grow", NOT "tcGrow)1").
   - Put all such marked words into the "markedWords" array as clean lowercase words (e.g. ["earnings", "grow"]).
   - If there are no underlines or circles, return an empty array [].

Output strictly valid JSON in this exact structure without markdown backticks:
{
  "text": "Clean transcribed article/prose text without any charts or graphs...",
  "markedWords": ["word1", "word2"]
}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2500,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API Error:', geminiRes.status, errBody);
      return NextResponse.json(
        { error: 'Gemini Vision API request failed', details: errBody },
        { status: geminiRes.status }
      );
    }

    const data = await geminiRes.json();
    const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let text = rawOutput;
    let markedWords: string[] = [];

    try {
      const cleanJson = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed.text === 'string') text = parsed.text;
      const detected = parsed.markedWords || parsed.underlinedWords;
      if (Array.isArray(detected)) {
        markedWords = detected
          .map((w: any) => String(w || '').trim().toLowerCase().replace(/[^a-zA-Z'-]/g, ''))
          .filter((w: string) => w.length >= 2);
      }
    } catch {
      text = rawOutput;
    }

    return NextResponse.json({ text, markedWords });
  } catch (err: any) {
    console.error('OCR API Route Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
