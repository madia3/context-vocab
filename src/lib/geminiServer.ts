import crypto from 'crypto';

// Shared server-side Gemini API model configuration, rate limiter & fast fallback caller
// Optimized to remember the fastest working model and avoid sequential timeout cascades

export const GEMINI_COOKIE_NAME = 'cv_gemini_key';
const OBFUSCATION_SALT = 'divivid_voca_key_shield_v1';

function getServerCipherKey(): Buffer {
  const secret =
    process.env.GEMINI_KEY_SECRET ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'divivid-context-vocab-aes-256-gcm-secret-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a personal Gemini API key on the server using AES-256-GCM.
 */
export function encryptGeminiKey(plainKey: string): string {
  const clean = plainKey.trim();
  if (!clean) return '';
  if (clean.startsWith('enc:')) return clean;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getServerCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

/**
 * Decrypts an AES-256-GCM (`enc:...`) or client-shielded (`obf:...`) Gemini API key.
 */
export function decryptGeminiKey(token?: string | null): string {
  if (!token) return '';
  const trimmed = token.trim();
  if (!trimmed || trimmed.includes('••') || trimmed.includes('**')) return '';

  if (trimmed.startsWith('enc:')) {
    try {
      const payload = trimmed.slice(4);
      const [ivB64, tagB64, dataB64] = payload.split('.');
      if (!ivB64 || !tagB64 || !dataB64) return '';
      const iv = Buffer.from(ivB64, 'base64url');
      const authTag = Buffer.from(tagB64, 'base64url');
      const encrypted = Buffer.from(dataB64, 'base64url');
      const decipher = crypto.createDecipheriv('aes-256-gcm', getServerCipherKey(), iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8').trim();
    } catch {
      return '';
    }
  }

  if (trimmed.startsWith('obf:')) {
    try {
      const rawBytes = Buffer.from(trimmed.slice(4), 'base64');
      const saltBytes = Buffer.from(OBFUSCATION_SALT, 'utf8');
      const out = Buffer.alloc(rawBytes.length);
      for (let i = 0; i < rawBytes.length; i++) {
        out[i] = rawBytes[i] ^ saltBytes[i % saltBytes.length];
      }
      return out.toString('utf8').trim();
    } catch {
      return '';
    }
  }

  return trimmed;
}

export function maskGeminiKey(plainKey: string): string {
  const clean = decryptGeminiKey(plainKey);
  if (!clean || clean.length < 10) return '';
  return `${clean.slice(0, 6)}••••••••••••••••••••${clean.slice(-4)}`;
}

function extractCookieValue(cookieHeader: string | null, name: string): string {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) {
      try {
        return decodeURIComponent(v.join('='));
      } catch {
        return v.join('=');
      }
    }
  }
  return '';
}

export interface GeminiModelCandidate {
  model: string;
  thinkingConfig?: Record<string, any>;
  timeoutMs: number;
}

// Fast models on Google Generative Language v1beta API (prioritized by official availability & speed)
// Vercel Serverless Function timeout (10s on hobby plan) safe: individual timeouts strictly under 8.5s
export const FAST_GEMINI_CANDIDATES: GeminiModelCandidate[] = [
  {
    model: 'gemini-2.0-flash',
    timeoutMs: 8500,
  },
  {
    model: 'gemini-1.5-flash',
    timeoutMs: 8500,
  },
  {
    model: 'gemini-2.0-flash-lite',
    timeoutMs: 7000,
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
 * Safely resolves the Gemini API key on the server (supports AES-256-GCM encrypted token, HttpOnly cookie, or server env).
 */
export function resolveServerGeminiKey(req: Request, explicitKey?: string): string {
  const fromExplicit = decryptGeminiKey(explicitKey);
  if (fromExplicit) return fromExplicit;

  const fromHeader = decryptGeminiKey(req.headers.get('x-gemini-key'));
  if (fromHeader) return fromHeader;

  const fromCookie = decryptGeminiKey(extractCookieValue(req.headers.get('cookie'), GEMINI_COOKIE_NAME));
  if (fromCookie) return fromCookie;

  const fromServerEnv = process.env.GEMINI_API_KEY?.trim();
  return fromServerEnv || '';
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

        // Early abort ONLY if API Key is definitively invalid (do not waste time trying other models)
        if (
          res.status === 401 ||
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

  // If client-provided key failed due to invalid key or auth error, and server environment has a fallback key, retry once with server env key
  const serverEnvKey = process.env.GEMINI_API_KEY?.trim();
  if (serverEnvKey && apiKey !== serverEnvKey && (lastError.includes('API_KEY_INVALID') || lastError.includes('401') || lastError.includes('403'))) {
    console.warn('Client-provided Gemini API key failed with auth error, falling back to server GEMINI_API_KEY...');
    return callGeminiWithFallback({
      ...options,
      apiKey: serverEnvKey,
    });
  }

  return {
    ok: false,
    text: '',
    lastError,
  };
}
