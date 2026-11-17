import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/geminiServer';

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

    const res = await callGeminiWithFallback({
      apiKey: keyToTest,
      parts: [{ text: 'Hi' }],
      temperature: 0.0,
      responseMimeType: 'text/plain',
      maxOutputTokens: 10,
    });

    if (res.ok) {
      return NextResponse.json({
        ok: true,
        message: `Google Gemini AI 연동 성공! (${res.modelUsed})`,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: '유효하지 않은 API 키이거나 모델 호출에 실패했습니다.',
        details: res.lastError,
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || '네트워크 연결 오류' }, { status: 500 });
  }
}
