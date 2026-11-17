import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { base64, mimeType } = await req.json();

    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json({ error: 'Image base64 data is required' }, { status: 400 });
    }

    if (base64.length > 12_000_000) {
      return NextResponse.json({ error: 'Image payload too large' }, { status: 413 });
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

    // Google Gemini REST API 호출 (가장 빠른 gemini-3.5-flash-lite 우선 시도, 다단계 폴백)
    const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ];

    const prompt = `You are a high-precision OCR and document analysis AI specializing in English books, news articles, and research reports.
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

    let data: any = null;
    let lastError: string = '';

    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8500),
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
              temperature: 0.0,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (geminiRes.ok) {
          data = await geminiRes.json();
          break;
        } else {
          lastError = await geminiRes.text();
          console.warn(`Model ${model} failed with status ${geminiRes.status}:`, lastError);
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`Model ${model} request error:`, err);
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Gemini Vision API request failed', details: lastError },
        { status: 502 }
      );
    }
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
