import { NextRequest, NextResponse } from 'next/server';
import { isUserAdmin } from '@/lib/admin';
import {
  getServerUsageReport,
  pingServerGeminiKey,
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
    return NextResponse.json({
      ok: true,
      report,
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

    return NextResponse.json({ ok: false, error: '지원하지 않는 동작입니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
