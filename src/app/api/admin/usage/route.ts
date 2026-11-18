import { NextRequest, NextResponse } from 'next/server';
import { isUserAdmin } from '@/lib/admin';
import {
  getServerUsageReport,
  pingServerGeminiKey,
  resetServerUsageStats,
  clearRateLimitCache,
  clearServerUsageLogs,
  getServerSystemInfo,
  callGeminiWithFallback,
} from '@/lib/geminiServer';

export const runtime = 'nodejs';

/**
 * Admin-only API endpoint to inspect Vercel environment GEMINI_API_KEY usage,
 * daily quota status, and run real-time diagnostic latency pings.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email =
      req.headers.get('x-user-email') ||
      url.searchParams.get('email') ||
      '';

    if (!isUserAdmin(email)) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다. (Admin access required)' },
        { status: 403 }
      );
    }

    const report = getServerUsageReport();
    const systemInfo = getServerSystemInfo();
    return NextResponse.json({
      ok: true,
      report,
      systemInfo,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to get server usage report' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      req.headers.get('x-user-email') ||
      body?.email ||
      '';

    if (!isUserAdmin(email)) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다. (Admin access required)' },
        { status: 403 }
      );
    }

    const { action } = body;
    if (action === 'ping') {
      const pingResult = await pingServerGeminiKey();
      return NextResponse.json(pingResult);
    }

    if (action === 'reset_counter') {
      const report = resetServerUsageStats();
      return NextResponse.json({ ok: true, report, message: '오늘의 서버 API 호출 카운터가 0으로 초기화되었습니다.' });
    }

    if (action === 'clear_rate_limits') {
      const result = clearRateLimitCache();
      return NextResponse.json({ ok: true, ...result, message: `총 ${result.countCleared}개의 IP 접속 제한 캐시가 해제되었습니다.` });
    }

    if (action === 'clear_logs') {
      const report = clearServerUsageLogs();
      return NextResponse.json({ ok: true, report, message: '최근 API 호출 기록이 정리되었습니다.' });
    }

    if (action === 'system_info') {
      const info = getServerSystemInfo();
      return NextResponse.json({ ok: true, info });
    }

    if (action === 'test_ai_prompt') {
      const promptText = (body?.prompt || '').trim() || 'Tell me an interesting English idiom with meaning and example in JSON format.';
      const serverKey = process.env.GEMINI_API_KEY?.trim() || '';
      if (!serverKey) {
        return NextResponse.json({ ok: false, error: 'Vercel 서버 GEMINI_API_KEY가 등록되어 있지 않습니다.' });
      }

      const startTime = Date.now();
      const aiRes = await callGeminiWithFallback({
        apiKey: serverKey,
        parts: [{ text: promptText }],
        temperature: typeof body?.temperature === 'number' ? body.temperature : 0.2,
        responseMimeType: body?.mimeType || 'application/json',
        endpoint: 'admin-sandbox',
      });

      return NextResponse.json({
        ok: aiRes.ok,
        text: aiRes.text,
        modelUsed: aiRes.modelUsed,
        latencyMs: Date.now() - startTime,
        error: aiRes.lastError,
      });
    }

    return NextResponse.json({ ok: false, error: '지원하지 않는 동작입니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
