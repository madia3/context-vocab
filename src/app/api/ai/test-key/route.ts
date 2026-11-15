import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    const keyToTest =
      apiKey ||
      req.headers.get('x-gemini-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!keyToTest) {
      return NextResponse.json({ ok: false, error: 'API 키가 전달되지 않았습니다.' }, { status: 400 });
    }

    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyToTest}`;

    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ ok: false, error: '유효하지 않은 API 키입니다.', details: errText }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: 'Google Gemini AI 연동 성공!' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || '네트워크 연결 오류' }, { status: 500 });
  }
}
