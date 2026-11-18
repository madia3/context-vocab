import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
    model: 'gemini-3.8-flash',
    thinkingConfig: { thinkingBudget: 0 },
    timeoutMs: 8500,
  },
  {
    model: 'gemini-2.5-flash',
    thinkingConfig: { thinkingBudget: 0 },
    timeoutMs: 8500,
  },
  {
    model: 'gemini-3.5-flash-lite',
    timeoutMs: 7000,
  },
  {
    model: 'gemini-1.5-flash',
    timeoutMs: 8500,
  },
];

// Remember the last model that succeeded so subsequent calls hit the working model on attempt #1
let lastSuccessfulModelName: string | null = null;

// Server-side Gemini API Usage Tracker (persists across warm serverless lambdas in /tmp)
export interface ServerUsageLogItem {
  id: string;
  timestamp: number;
  endpoint: string;
  model: string;
  status: 'ok' | 'error';
  durationMs: number;
  keyType: 'vercel_env' | 'custom_key';
  error?: string;
}

export interface ServerUsageReport {
  isConfigured: boolean;
  maskedKey: string;
  keyLength: number;
  todayDate: string;
  serverEnvCallsToday: number;
  customKeyCallsToday: number;
  totalCallsToday: number;
  dailyLimit: number;
  remainingCalls: number;
  usagePercent: number;
  rpmLimit: number;
  lastActiveModel: string | null;
  lastCallAt: number | null;
  byEndpoint: {
    matchSentence: number;
    visionOcr: number;
    translate: number;
    dictionary: number;
    other: number;
  };
  recentLogs: ServerUsageLogItem[];
}

function getTodayServerDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const USAGE_FILE_PATH = path.join('/tmp', 'cv_gemini_server_usage.json');

interface PersistedServerUsage {
  todayDate: string;
  serverEnvCallsToday: number;
  customKeyCallsToday: number;
  byEndpoint: {
    matchSentence: number;
    visionOcr: number;
    translate: number;
    dictionary: number;
    other: number;
  };
  lastActiveModel: string | null;
  lastCallAt: number | null;
  recentLogs: ServerUsageLogItem[];
}

let inMemoryServerUsage: PersistedServerUsage = {
  todayDate: getTodayServerDate(),
  serverEnvCallsToday: 0,
  customKeyCallsToday: 0,
  byEndpoint: {
    matchSentence: 0,
    visionOcr: 0,
    translate: 0,
    dictionary: 0,
    other: 0,
  },
  lastActiveModel: null,
  lastCallAt: null,
  recentLogs: [],
};

function loadServerUsage(): PersistedServerUsage {
  const today = getTodayServerDate();
  try {
    if (fs.existsSync(USAGE_FILE_PATH)) {
      const content = fs.readFileSync(USAGE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.todayDate === today) {
        inMemoryServerUsage = parsed;
        return inMemoryServerUsage;
      }
    }
  } catch {}

  // If new day or file missing, reset for today
  if (inMemoryServerUsage.todayDate !== today) {
    inMemoryServerUsage = {
      todayDate: today,
      serverEnvCallsToday: 0,
      customKeyCallsToday: 0,
      byEndpoint: {
        matchSentence: 0,
        visionOcr: 0,
        translate: 0,
        dictionary: 0,
        other: 0,
      },
      lastActiveModel: inMemoryServerUsage.lastActiveModel,
      lastCallAt: inMemoryServerUsage.lastCallAt,
      recentLogs: [],
    };
    saveServerUsage();
  }
  return inMemoryServerUsage;
}

function saveServerUsage() {
  try {
    fs.writeFileSync(USAGE_FILE_PATH, JSON.stringify(inMemoryServerUsage), 'utf8');
  } catch {}
}

export function recordServerUsage(entry: {
  isServerKey: boolean;
  endpoint: string;
  model: string;
  status: 'ok' | 'error';
  durationMs: number;
  error?: string;
}) {
  const usage = loadServerUsage();
  if (entry.isServerKey) {
    usage.serverEnvCallsToday += 1;
  } else {
    usage.customKeyCallsToday += 1;
  }

  const ep = (entry.endpoint || '').toLowerCase();
  if (ep.includes('match') || ep.includes('sentence')) {
    usage.byEndpoint.matchSentence = (usage.byEndpoint.matchSentence || 0) + 1;
  } else if (ep.includes('ocr') || ep.includes('vision')) {
    usage.byEndpoint.visionOcr = (usage.byEndpoint.visionOcr || 0) + 1;
  } else if (ep.includes('translate')) {
    usage.byEndpoint.translate = (usage.byEndpoint.translate || 0) + 1;
  } else if (ep.includes('dict')) {
    usage.byEndpoint.dictionary = (usage.byEndpoint.dictionary || 0) + 1;
  } else {
    usage.byEndpoint.other = (usage.byEndpoint.other || 0) + 1;
  }

  if (entry.status === 'ok') {
    usage.lastActiveModel = entry.model;
  }
  usage.lastCallAt = Date.now();

  const logItem: ServerUsageLogItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    endpoint: entry.endpoint || 'general',
    model: entry.model,
    status: entry.status,
    durationMs: Math.round(entry.durationMs),
    keyType: entry.isServerKey ? 'vercel_env' : 'custom_key',
    error: entry.error ? entry.error.slice(0, 100) : undefined,
  };

  if (!Array.isArray(usage.recentLogs)) {
    usage.recentLogs = [];
  }
  usage.recentLogs.unshift(logItem);
  if (usage.recentLogs.length > 30) {
    usage.recentLogs = usage.recentLogs.slice(0, 30);
  }

  saveServerUsage();
}

export function getServerUsageReport(): ServerUsageReport {
  const usage = loadServerUsage();
  const serverKey = process.env.GEMINI_API_KEY?.trim() || '';
  const isConfigured = Boolean(serverKey && serverKey.length >= 10);
  const maskedKey = isConfigured ? maskGeminiKey(serverKey) : '미설정 (process.env.GEMINI_API_KEY)';
  const dailyLimit = 1500;
  const totalCalls = usage.serverEnvCallsToday + usage.customKeyCallsToday;
  const remainingCalls = Math.max(0, dailyLimit - usage.serverEnvCallsToday);
  const usagePercent = Math.min(100, Math.round((usage.serverEnvCallsToday / dailyLimit) * 100));

  return {
    isConfigured,
    maskedKey,
    keyLength: serverKey.length,
    todayDate: usage.todayDate,
    serverEnvCallsToday: usage.serverEnvCallsToday,
    customKeyCallsToday: usage.customKeyCallsToday,
    totalCallsToday: totalCalls,
    dailyLimit,
    remainingCalls,
    usagePercent,
    rpmLimit: 15,
    lastActiveModel: usage.lastActiveModel || lastSuccessfulModelName || 'gemini-2.5-flash',
    lastCallAt: usage.lastCallAt,
    byEndpoint: usage.byEndpoint,
    recentLogs: usage.recentLogs || [],
  };
}

export function clearRateLimitCache(): { countCleared: number } {
  const count = ipRequestMap.size;
  ipRequestMap.clear();
  return { countCleared: count };
}

export function resetServerUsageStats(): ServerUsageReport {
  const usage = loadServerUsage();
  usage.serverEnvCallsToday = 0;
  usage.customKeyCallsToday = 0;
  usage.byEndpoint = {
    matchSentence: 0,
    visionOcr: 0,
    translate: 0,
    dictionary: 0,
    other: 0,
  };
  saveServerUsage();
  return getServerUsageReport();
}

export function clearServerUsageLogs(): ServerUsageReport {
  const usage = loadServerUsage();
  usage.recentLogs = [];
  saveServerUsage();
  return getServerUsageReport();
}

export function getServerSystemInfo() {
  const mem = process.memoryUsage();
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptimeSec: Math.round(process.uptime()),
    vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    vercelRegion: process.env.VERCEL_REGION || 'local',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 10),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    rateLimitBlockedCount: ipRequestMap.size,
  };
}

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
  endpoint?: string;
}): Promise<{ ok: boolean; text: string; rawData?: any; modelUsed?: string; lastError?: string; durationMs?: number }> {
  const {
    apiKey,
    parts,
    temperature = 0.0,
    responseMimeType = 'application/json',
    maxOutputTokens,
    candidates = FAST_GEMINI_CANDIDATES,
    endpoint = 'general',
  } = options;

  const startTime = Date.now();
  const cleanApiKey = (apiKey || '').trim();
  const serverEnvKey = process.env.GEMINI_API_KEY?.trim() || '';
  const isServerKey = Boolean(serverEnvKey && cleanApiKey === serverEnvKey);

  if (!cleanApiKey) {
    return { ok: false, text: '', lastError: 'API 키가 비어있습니다.' };
  }

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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;
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
          const durationMs = Date.now() - startTime;
          recordServerUsage({
            isServerKey,
            endpoint,
            model: candidate.model,
            status: 'ok',
            durationMs,
          });
          return {
            ok: true,
            text,
            rawData: data,
            modelUsed: candidate.model,
            durationMs,
          };
        }
      } else {
        lastError = await res.text();

        // If a model is not found or unsupported, clear last successful model memory
        if (res.status === 404 || lastError.includes('not found') || lastError.includes('not supported') || lastError.includes('deprecated')) {
          if (lastSuccessfulModelName === candidate.model) {
            lastSuccessfulModelName = null;
          }
        }

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
              const durationMs = Date.now() - startTime;
              recordServerUsage({
                isServerKey,
                endpoint,
                model: candidate.model,
                status: 'ok',
                durationMs,
              });
              return {
                ok: true,
                text: retryText,
                rawData: retryData,
                modelUsed: candidate.model,
                durationMs,
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
  if (serverEnvKey && apiKey !== serverEnvKey && (lastError.includes('API_KEY_INVALID') || lastError.includes('401') || lastError.includes('403'))) {
    console.warn('Client-provided Gemini API key failed with auth error, falling back to server GEMINI_API_KEY...');
    return callGeminiWithFallback({
      ...options,
      apiKey: serverEnvKey,
      endpoint: `${endpoint}-fallback`,
    });
  }

  const durationMs = Date.now() - startTime;
  recordServerUsage({
    isServerKey,
    endpoint,
    model: orderedCandidates[0]?.model || 'gemini',
    status: 'error',
    durationMs,
    error: lastError,
  });

  return {
    ok: false,
    text: '',
    lastError,
    durationMs,
  };
}

/**
 * Real-time diagnostic ping test for Vercel process.env.GEMINI_API_KEY
 */
export async function pingServerGeminiKey(): Promise<{
  ok: boolean;
  serverConfigured: boolean;
  modelUsed?: string;
  durationMs: number;
  error?: string;
  timestamp: number;
}> {
  const serverKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!serverKey) {
    return {
      ok: false,
      serverConfigured: false,
      durationMs: 0,
      error: 'Vercel 환경 변수에 GEMINI_API_KEY가 등록되어 있지 않습니다.',
      timestamp: Date.now(),
    };
  }

  const startTime = Date.now();
  const res = await callGeminiWithFallback({
    apiKey: serverKey,
    parts: [{ text: 'Ping. Reply OK.' }],
    temperature: 0.0,
    responseMimeType: 'text/plain',
    maxOutputTokens: 5,
    endpoint: 'admin-ping',
  });

  return {
    ok: res.ok,
    serverConfigured: true,
    modelUsed: res.modelUsed,
    durationMs: Date.now() - startTime,
    error: res.lastError,
    timestamp: Date.now(),
  };
}
