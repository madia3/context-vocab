import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, checkRateLimit, resolveServerGeminiKeyAsync } from '@/lib/geminiServer';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const cleanInput = text.trim();

    // 1. Fast Google Translate Client API (무료, 초고속)
    try {
      const gRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(
          cleanInput
        )}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (gRes.ok) {
        const gData = await gRes.json();
        if (Array.isArray(gData?.[0])) {
          const translated = gData[0]
            .map((seg: any) => (Array.isArray(seg) && seg[0] ? String(seg[0]) : ''))
            .join('')
            .trim();
          if (translated) {
            return NextResponse.json({ translation: translated, method: 'google' });
          }
        }
      }
    } catch (gErr) {
      console.warn('Google translate API fallback:', gErr);
    }

    // 2. Gemini AI Fallback (Google Translate 실패 시)
    const apiKey = await resolveServerGeminiKeyAsync(req);
    if (apiKey) {
      const prompt = `Translate the following English context sentence into natural, fluent Korean.
Context:
"${cleanInput}"

RULES:
1. Translate faithfully preserving the original nuance and context.
2. Return ONLY the translated Korean sentence without quotes, explanations, or prefixes.`;

      const aiRes = await callGeminiWithFallback({
        apiKey,
        endpoint: 'translate',
        parts: [{ text: prompt }],
        temperature: 0.1,
        responseMimeType: 'text/plain',
      });

      if (aiRes.ok && aiRes.text?.trim()) {
        const cleanAiTrans = aiRes.text.trim().replace(/^["'“”]|["'“”]$/g, '').trim();
        return NextResponse.json({ translation: cleanAiTrans, method: 'gemini' });
      }
    }

    return NextResponse.json(
      { error: '번역 서비스를 일시적으로 사용할 수 없습니다.' },
      { status: 502 }
    );
  } catch (err: any) {
    console.error('Translation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Translation failed' },
      { status: 500 }
    );
  }
}
