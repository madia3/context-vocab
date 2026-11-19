import { NextRequest, NextResponse } from 'next/server';
import {
  callGeminiWithFallback,
  checkRateLimit,
  deleteUserPersonalGeminiKeyFromSupabase,
  GEMINI_COOKIE_NAME,
  getAuthenticatedUserFromRequest,
  getServerKeyQuotaStatusAsync,
  getUserPersonalGeminiKeyFromSupabase,
  saveUserPersonalGeminiKeyToSupabase,
} from '@/lib/geminiServer';

export const runtime = 'nodejs';

function clearLegacyCookie(res: NextResponse) {
  res.cookies.set(GEMINI_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function GET(req: NextRequest) {
  const serverKey = process.env.GEMINI_API_KEY?.trim() || '';
  const authUser = await getAuthenticatedUserFromRequest(req);

  let hasPersonalKey = false;
  let maskedKey = '';

  if (authUser) {
    const personal = await getUserPersonalGeminiKeyFromSupabase(authUser.accessToken, authUser.id);
    hasPersonalKey = personal.hasKey;
    maskedKey = personal.maskedKey;
  }

  const serverQuota = await getServerKeyQuotaStatusAsync(req, {
    hasPersonalKey,
    userId: authUser?.id,
    userEmail: authUser?.email,
  });

  return NextResponse.json({
    serverConfigured: Boolean(serverKey && serverKey.length >= 10),
    isAuthenticated: Boolean(authUser),
    hasPersonalKey,
    maskedKey,
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

    const authUser = await getAuthenticatedUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json(
        {
          ok: false,
          code: 'AUTH_REQUIRED',
          error: '개인 API 키 등록 및 관리는 로그인 후 이용할 수 있습니다.',
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { apiKey, action } = body;

    if (action === 'clear') {
      const delRes = await deleteUserPersonalGeminiKeyFromSupabase(
        authUser.accessToken,
        authUser.id
      );
      if (!delRes.ok) {
        return NextResponse.json(
          { ok: false, error: delRes.error || '개인 API 키 삭제에 실패했습니다.' },
          { status: 500 }
        );
      }
      const clearRes = NextResponse.json({
        ok: true,
        cleared: true,
        hasPersonalKey: false,
        maskedKey: '',
      });
      clearLegacyCookie(clearRes);
      return clearRes;
    }

    const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (!cleanKey) {
      return NextResponse.json(
        { ok: false, error: '등록할 Google Gemini API 키를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const res = await callGeminiWithFallback({
      apiKey: cleanKey,
      parts: [{ text: 'Respond with OK.' }],
      temperature: 0.0,
      responseMimeType: 'text/plain',
      maxOutputTokens: 100,
      endpoint: 'test-key',
    });

    if (res.ok) {
      const saveRes = await saveUserPersonalGeminiKeyToSupabase(
        authUser.accessToken,
        authUser.id,
        cleanKey
      );
      if (!saveRes.ok) {
        return NextResponse.json(
          { ok: false, error: saveRes.error || '계정 암호화 저장에 실패했습니다.' },
          { status: 500 }
        );
      }

      const response = NextResponse.json({
        ok: true,
        hasPersonalKey: true,
        maskedKey: saveRes.maskedKey,
        message: `Google Gemini AI 연동 및 계정 암호화 저장 완료! (${res.modelUsed})`,
      });

      // 브라우저 로컬/쿠키 저장 제거 정책에 따라 기존 레거시 쿠키가 있다면 정리
      clearLegacyCookie(response);
      return response;
    }

    let errorMessage = '유효하지 않은 API 키이거나 모델 호출에 실패했습니다.';
    if (res.lastError) {
      if (res.lastError.includes('API_KEY_INVALID')) {
        errorMessage =
          '유효하지 않은 API 키입니다. Google AI Studio(aistudio.google.com)에서 발급받은 키(AQ... 또는 AIza...)를 정확히 복사했는지 확인해 주세요.';
      } else if (res.lastError.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'Gemini API 무료 요청 한도(RPM/RPD)가 초과되었습니다. 잠시 후 다시 시도해 주세요.';
      } else if (
        res.lastError.includes('not found') ||
        res.lastError.includes('not supported') ||
        res.lastError.includes('404')
      ) {
        errorMessage =
          'Google API 오류: 계정에서 지원하는 Gemini 모델을 찾지 못했습니다. Google AI Studio(aistudio.google.com)에서 새 API Key를 발급받아 교체해 주세요.';
      } else if (
        res.lastError.includes('Timeout') ||
        res.lastError.includes('abort') ||
        res.lastError.includes('aborted')
      ) {
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
