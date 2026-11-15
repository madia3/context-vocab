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

    const prompt = `You are a high-precision OCR and document layout restoration AI for English books.
Carefully read the photographed English book page and transcribe all text.
Follow these strict rules:
1. Fix all OCR misreads, split words across hyphenated line breaks (e.g. "con- / dition" -> "condition"), and typo noise.
2. Ignore page numbers, running headers, and running footers.
3. Keep the natural sentences and paragraphs in proper order.
4. Output ONLY the extracted clean English text with standard punctuation. Do NOT include markdown code blocks, conversational comments, or explanations.`;

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
          maxOutputTokens: 2048,
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
    const transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ text: transcribedText });
  } catch (err: any) {
    console.error('OCR API Route Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
