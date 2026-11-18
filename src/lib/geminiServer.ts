// Shared server-side Gemini API model configuration, rate limiter & fast fallback caller
// Optimized to remember the fastest working model and avoid sequential timeout cascades

export interface GeminiModelCandidate {
  model: string;
  thinkingConfig?: Record<string, any>;
  timeoutMs: number;
}

// Fast models on Google Generative Language v1beta API
export const FAST_GEMINI_CANDIDATES: GeminiModelCandidate[] = [
  {
    model: 'gemini-3.5-flash-lite',
    thinkingConfig: { thinkingLevel: 'LOW' },
    timeoutMs: 3800,
  },
  {
    model: 'gemini-3.1-flash-lite',
    thinkingConfig: { thinkingBudget: 0 },
    timeoutMs: 3500,
  },
  {
    model: 'gemini-2.5-flash-lite',
    thinkingConfig: { thinkingBudget: 0 },
    timeoutMs: 3500,
  },
  {
    model: 'gemini-2.0-flash',
    timeoutMs: 3500,
  },
  {
    model: 'gemini-flash-lite-latest',
    thinkingConfig: { thinkingLevel: 'LOW' },
    timeoutMs: 3500,
  },
];

// Remember the last model that succeeded so subsequent calls hit the working model on attempt #1
let lastSuccessfulModelName: string | null = null;

// Per-IP Sliding Window Rate Limiter (protects API credits & server resources)
const ipRequestMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export function checkRateLimit(req: Request, maxRequestsPerMinute: number = 30): { allowed: boolean; retryAfterSec?: number } {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'anonymous';
    const now = Date.now();

    if (ipRequestMap.size > 5000) {
      ipRequestMap.clear();
    }

    const entry = ipRequestMap.get(ip);
    if (!entry || now > entry.resetAt) {
      ipRequestMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return { allowed: true };
    }

    if (entry.count >= maxRequestsPerMinute) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfterSec };
    }

    entry.count += 1;
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Safely resolves the Gemini API key on the server without relying on NEXT_PUBLIC_ client env exposure.
 */
export function resolveServerGeminiKey(req: Request, explicitKey?: string): string {
  const fromHeader = req.headers.get('x-gemini-key')?.trim();
  const fromExplicit = explicitKey?.trim();
  const fromServerEnv = process.env.GEMINI_API_KEY?.trim();
  return fromExplicit || fromHeader || fromServerEnv || '';
}

export async function callGeminiWithFallback(options: {
  apiKey: string;
  parts: any[];
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  candidates?: GeminiModelCandidate[];
}): Promise<{ ok: boolean; text: string; rawData?: any; modelUsed?: string; lastError?: string }> {
  const {
    apiKey,
    parts,
    temperature = 0.0,
    responseMimeType = 'application/json',
    maxOutputTokens,
    candidates = FAST_GEMINI_CANDIDATES,
  } = options;

  // Prioritize the last known working model first to avoid 404/timeout overhead
  const orderedCandidates = [...candidates];
  if (lastSuccessfulModelName) {
    const idx = orderedCandidates.findIndex((c) => c.model === lastSuccessfulModelName);
    if (idx > 0) {
      const [preferred] = orderedCandidates.splice(idx, 1);
      orderedCandidates.unshift(preferred);
    }
  }

  let lastError = '';

  for (const candidate of orderedCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${apiKey}`;
      const generationConfig: Record<string, any> = {
        temperature,
      };
      if (responseMimeType) {
        generationConfig.responseMimeType = responseMimeType;
      }
      if (typeof maxOutputTokens === 'number') {
        generationConfig.maxOutputTokens = maxOutputTokens;
      }
      if (candidate.thinkingConfig) {
        generationConfig.thinkingConfig = candidate.thinkingConfig;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(candidate.timeoutMs),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          lastSuccessfulModelName = candidate.model;
          return {
            ok: true,
            text,
            rawData: data,
            modelUsed: candidate.model,
          };
        }
      } else {
        lastError = await res.text();

        // Early abort if API Key is invalid or forbidden (do not waste time trying other models)
        if (
          res.status === 401 ||
          res.status === 403 ||
          (res.status === 400 && lastError.includes('API_KEY_INVALID'))
        ) {
          break;
        }

        // If 400 Invalid Argument due to thinkingConfig on an alias model, retry immediately without thinkingConfig
        if (res.status === 400 && candidate.thinkingConfig) {
          const retryGenConfig: Record<string, any> = { temperature };
          if (responseMimeType) retryGenConfig.responseMimeType = responseMimeType;
          if (typeof maxOutputTokens === 'number') retryGenConfig.maxOutputTokens = maxOutputTokens;

          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(candidate.timeoutMs),
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: retryGenConfig,
            }),
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (retryText) {
              lastSuccessfulModelName = candidate.model;
              return {
                ok: true,
                text: retryText,
                rawData: retryData,
                modelUsed: candidate.model,
              };
            }
          }
        }
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  return {
    ok: false,
    text: '',
    lastError,
  };
}
