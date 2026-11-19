import { NextRequest, NextResponse } from 'next/server';
import {
  callGeminiWithFallback,
  checkRateLimit,
  encryptGeminiKey,
  GEMINI_COOKIE_NAME,
  getServerKeyQuotaStatusAsync,
  maskGeminiKey,
  resolveServerGeminiKey,
} from '@/lib/geminiServer';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const serverKey = process.env.GEMINI_API_KEY?.trim() || '';
  const serverQuota = await getServerKeyQuotaStatusAsync(req);
  return NextResponse.json({
    serverConfigured: Boolean(serverKey && serverKey.length >= 10),
    serverQuota,
  });
}

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 15);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { apiKey, action } = body;

    if (action === 'clear') {
      const clearRes = NextResponse.json({ ok: true, cleared: true });
      clearRes.cookies.set(GEMINI_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return clearRes;
    }

    const keyToTest = resolveServerGeminiKey(req, apiKey);

    if (!keyToTest) {
      return NextResponse.json({ ok: false, error: 'API 키가 전달되지 않았습니다.' }, { status: 400 });
    }

    const res = await callGeminiWithFallback({
      apiKey: keyToTest,
      parts: [{ text: 'Respond with OK.' }],
      temperature: 0.0,
      responseMimeType: 'text/plain',
      maxOutputTokens: 100,
      endpoint: 'test-key',
    });

    if (res.ok) {
      const encryptedToken = encryptGeminiKey(keyToTest);
      const maskedKey = maskGeminiKey(keyToTest);
      const response = NextResponse.json({
        ok: true,
        encryptedToken,
        maskedKey,
        message: `Google Gemini AI 연동 성공! (${res.modelUsed})`,
      });

      // 서버 AES-256-GCM 암호화 토큰을 HttpOnly 보안 쿠키에도 저장 (XSS/평문 노출 원천 차단)
      response.cookies.set(GEMINI_COOKIE_NAME, encryptedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });

      return response;
    }

    let errorMessage = '유효하지 않은 API 키이거나 모델 호출에 실패했습니다.';
    if (res.lastError) {
      if (res.lastError.includes('API_KEY_INVALID')) {
        errorMessage = '유효하지 않은 API 키입니다. Google AI Studio(aistudio.google.com)에서 발급받은 키(AQ... 또는 AIza...)를 정확히 복사했는지 확인해 주세요.';
      } else if (res.lastError.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'Gemini API 무료 요청 한도(RPM/RPD)가 초과되었습니다. 잠시 후 다시 시도해 주세요.';
      } else if (res.lastError.includes('not found') || res.lastError.includes('not supported') || res.lastError.includes('404')) {
        errorMessage = 'Google API 오류: 계정에서 지원하는 Gemini 모델을 찾지 못했습니다. Google AI Studio(aistudio.google.com)에서 새 API Key를 발급받아 교체해 주세요.';
      } else if (res.lastError.includes('Timeout') || res.lastError.includes('abort') || res.lastError.includes('aborted')) {
        errorMessage = 'Google API 응답 시간 초과 (네트워크 지연). 잠시 후 다시 시도해 주세요.';
      } else {
        try {
          const parsed = JSON.parse(res.lastError);
          if (parsed?.error?.message) {
            errorMessage = `Google API 오류: ${parsed.error.message}`;
          }
        } catch {
          if (res.lastError.length < 150) {
            errorMessage = `Google API 오류: ${res.lastError}`;
          }
        }
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        details: res.lastError,
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || '네트워크 연결 오류' }, { status: 500 });
  }
}
