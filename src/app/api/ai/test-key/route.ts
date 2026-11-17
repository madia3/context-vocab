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

    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ];

    let lastErr = '';
    for (const model of candidateModels) {
      try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToTest}`;
        const res = await fetch(testUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
          }),
        });

        if (res.ok) {
          return NextResponse.json({ ok: true, message: `Google Gemini AI 연동 성공! (${model})` });
        } else {
          lastErr = await res.text();
        }
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }

    return NextResponse.json({ ok: false, error: '유효하지 않은 API 키이거나 모델 호출에 실패했습니다.', details: lastErr }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || '네트워크 연결 오류' }, { status: 500 });
  }
}
