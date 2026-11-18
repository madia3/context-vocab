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
  apiVersion?: 'v1' | 'v1beta';
  thinkingConfig?: Record<string, any>;
  timeoutMs: number;
}

// Officially supported Google Generative Language API models (verified 2.50s direct response on production key)
export const FAST_GEMINI_CANDIDATES: GeminiModelCandidate[] = [
  {
    model: 'gemini-flash-lite-latest',
    apiVersion: 'v1beta',
    timeoutMs: 8500,
  },
  {
    model: 'gemini-3.1-flash-lite-preview',
    apiVersion: 'v1beta',
    timeoutMs: 8500,
  },
  {
    model: 'gemini-flash-latest',
    apiVersion: 'v1beta',
    timeoutMs: 8500,
  },
];

// Remember the last model that succeeded so subsequent calls hit the working model on attempt #1
let lastSuccessfulModelName: string | null = 'gemini-flash-lite-latest';
// Remember models that returned 404 / deprecated / no longer available / 0-quota so we never retry them
const unsupportedModelsCache = new Set<string>();

function getFastThinkingConfig(_modelName: string): Record<string, any> | undefined {
  return undefined;
}

function isModelUnsupportedError(status: number, errorText: string): boolean {
  const lower = (errorText || '').toLowerCase();
  return (
    status === 404 ||
    (status === 429 && (lower.includes('limit: 0') || lower.includes('quota') || lower.includes('resource_exhausted'))) ||
    lower.includes('not found') ||
    lower.includes('not supported') ||
    lower.includes('no longer available') ||
    lower.includes('deprecated') ||
    lower.includes('is retired')
  );
}

function extractTextFromGeminiResponse(data: any): string {
  const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
  if (!Array.isArray(parts) || parts.length === 0) return '';
  const nonThoughtParts = parts.filter((p) => p && !p.thought && typeof p.text === 'string' && p.text.trim().length > 0);
  if (nonThoughtParts.length > 0) {
    return nonThoughtParts.map((p) => p.text).join('');
  }
  const anyTextParts = parts.filter((p) => p && typeof p.text === 'string' && p.text.trim().length > 0);
  return anyTextParts.map((p) => p.text).join('');
}

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
    lastActiveModel: usage.lastActiveModel || lastSuccessfulModelName || 'gemini-flash-latest',
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

function scoreDiscoveredModel(modelName: string): number {
  const clean = modelName.replace(/^models\//, '').toLowerCase();
  if (clean === 'gemini-flash-lite-latest') return 100;
  if (clean.includes('flash-lite')) return 98;
  if ((clean.includes('gemini-3') || clean.includes('gemini-4')) && clean.includes('flash')) return 92;
  if (clean === 'gemini-flash-latest') return 85;
  if (clean.includes('2.5-flash')) return 70;
  if (clean.includes('2.0') && clean.includes('flash')) return 45;
  if (clean.includes('1.5') && clean.includes('flash')) return 30;
  if (clean.includes('flash')) return 40;
  return 10;
}

function isTextCapableGeminiModel(modelName: string): boolean {
  const clean = modelName.replace(/^models\//, '').toLowerCase();
  if (!clean.startsWith('gemini')) return false;
  const excludedKeywords = [
    'tts',
    'image',
    'embedding',
    'imagen',
    'veo',
    'lyria',
    'aqa',
    'audio',
    'live',
    'robotics',
    'computer-use',
    'learnlm',
    'thinking-exp',
  ];
  return !excludedKeywords.some((kw) => clean.includes(kw));
}

async function autoDiscoverWorkingModelAndCall(options: {
  apiKey: string;
  parts: any[];
  generationConfig: Record<string, any>;
  attemptLogs?: string[];
}): Promise<{ ok: boolean; text: string; rawData?: any; modelUsed?: string; lastError?: string } | null> {
  const { apiKey, parts, generationConfig, attemptLogs } = options;
  let lastDiscoveryError = '';

  for (const ver of ['v1beta', 'v1']) {
    try {
      const listStart = Date.now();
      const listUrl = `https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(apiKey)}`;
      const listRes = await fetch(listUrl, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!listRes.ok) {
        lastDiscoveryError = await listRes.text();
        attemptLogs?.push(`ListModels(${ver}): HTTP ${listRes.status} (${((Date.now() - listStart) / 1000).toFixed(2)}s)`);
        continue;
      }

      const listData = await listRes.json();
      const models: any[] = listData.models || [];
      const supported = models
        .filter(
          (m) =>
            m?.name &&
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            isTextCapableGeminiModel(m.name) &&
            !unsupportedModelsCache.has(m.name.replace(/^models\//, ''))
        )
        .sort((a, b) => scoreDiscoveredModel(b.name) - scoreDiscoveredModel(a.name));

      attemptLogs?.push(`ListModels(${ver}): ${supported.length}개 발견 (${((Date.now() - listStart) / 1000).toFixed(2)}s)`);

      // Try up to 4 discovered models in priority order until one works
      for (const candidateModel of supported.slice(0, 4)) {
        const modelClean = candidateModel.name.replace(/^models\//, '');
        if (unsupportedModelsCache.has(modelClean)) continue;

        const callStart = Date.now();
        try {
          const callUrl = `https://generativelanguage.googleapis.com/${ver}/models/${modelClean}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const fastThinking = getFastThinkingConfig(modelClean);
          const modelGenConfig = fastThinking
            ? { ...generationConfig, thinkingConfig: fastThinking }
            : generationConfig;

          const genRes = await fetch(callUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            signal: AbortSignal.timeout(9500),
            body: JSON.stringify({ contents: [{ parts }], generationConfig: modelGenConfig }),
          });

          if (genRes.ok) {
            const genData = await genRes.json();
            const genText = extractTextFromGeminiResponse(genData);
            if (genText) {
              lastSuccessfulModelName = modelClean;
              attemptLogs?.push(`${modelClean}: OK (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);
              return {
                ok: true,
                text: genText,
                rawData: genData,
                modelUsed: modelClean,
              };
            }
          } else {
            const errText = await genRes.text();
            lastDiscoveryError = errText;
            attemptLogs?.push(`${modelClean}: HTTP ${genRes.status} (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);

            if (genRes.status === 400 && fastThinking) {
              const retryStart = Date.now();
              const retryRes = await fetch(callUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey,
                },
                signal: AbortSignal.timeout(9500),
                body: JSON.stringify({ contents: [{ parts }], generationConfig }),
              });
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                const retryText = extractTextFromGeminiResponse(retryData);
                if (retryText) {
                  lastSuccessfulModelName = modelClean;
                  attemptLogs?.push(`${modelClean}(retry): OK (${((Date.now() - retryStart) / 1000).toFixed(2)}s)`);
                  return {
                    ok: true,
                    text: retryText,
                    rawData: retryData,
                    modelUsed: modelClean,
                  };
                }
              }
            }

            if (isModelUnsupportedError(genRes.status, errText)) {
              unsupportedModelsCache.add(modelClean);
              continue;
            }
            if (genRes.status === 401 || (genRes.status === 400 && errText.includes('API_KEY_INVALID'))) {
              return { ok: false, text: '', lastError: errText };
            }
          }
        } catch (innerErr: any) {
          lastDiscoveryError = innerErr?.message || String(innerErr);
          attemptLogs?.push(`${modelClean}: 타임아웃/에러 (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);
        }
      }
    } catch (err: any) {
      lastDiscoveryError = err?.message || String(err);
    }
  }
  return lastDiscoveryError ? { ok: false, text: '', lastError: lastDiscoveryError } : null;
}

export async function callGeminiWithFallback(options: {
  apiKey: string;
  parts: any[];
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  candidates?: GeminiModelCandidate[];
  endpoint?: string;
}): Promise<{
  ok: boolean;
  text: string;
  rawData?: any;
  modelUsed?: string;
  lastError?: string;
  durationMs?: number;
  attemptLogs?: string[];
}> {
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
  const attemptLogs: string[] = [];
  const cleanApiKey = (apiKey || '').trim();
  const serverEnvKey = process.env.GEMINI_API_KEY?.trim() || '';
  const isServerKey = Boolean(serverEnvKey && cleanApiKey === serverEnvKey);

  if (!cleanApiKey) {
    return { ok: false, text: '', lastError: 'API 키가 비어있습니다.', attemptLogs };
  }

  // Restore last known working model from persisted usage if memory is cold
  if (!lastSuccessfulModelName) {
    const persistedModel = loadServerUsage().lastActiveModel;
    if (persistedModel && !unsupportedModelsCache.has(persistedModel)) {
      lastSuccessfulModelName = persistedModel;
    }
  }

  // Filter out models already known to be unsupported/deprecated for this key
  const orderedCandidates = candidates.filter((c) => !unsupportedModelsCache.has(c.model));
  if (lastSuccessfulModelName && !unsupportedModelsCache.has(lastSuccessfulModelName)) {
    const idx = orderedCandidates.findIndex((c) => c.model === lastSuccessfulModelName);
    if (idx > 0) {
      const [preferred] = orderedCandidates.splice(idx, 1);
      orderedCandidates.unshift(preferred);
    } else if (idx === -1) {
      orderedCandidates.unshift({
        model: lastSuccessfulModelName,
        apiVersion: 'v1beta',
        thinkingConfig: getFastThinkingConfig(lastSuccessfulModelName),
        timeoutMs: 10000,
      });
    }
  }

  let lastError = '';
  let attemptsMade = 0;

  for (const candidate of orderedCandidates) {
    if (unsupportedModelsCache.has(candidate.model)) continue;
    // After 2 failed attempts on static candidates, jump straight to dynamic ListModels discovery
    if (attemptsMade >= 2) break;
    attemptsMade += 1;

    const callStart = Date.now();
    const activeThinkingConfig = candidate.thinkingConfig || getFastThinkingConfig(candidate.model);

    try {
      const apiVer = candidate.apiVersion || 'v1beta';
      const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${candidate.model}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;
      const generationConfig: Record<string, any> = {
        temperature,
      };
      if (responseMimeType) {
        generationConfig.responseMimeType = responseMimeType;
      }
      if (typeof maxOutputTokens === 'number') {
        generationConfig.maxOutputTokens = maxOutputTokens;
      }
      if (activeThinkingConfig) {
        generationConfig.thinkingConfig = activeThinkingConfig;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanApiKey,
        },
        signal: AbortSignal.timeout(candidate.timeoutMs),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = extractTextFromGeminiResponse(data);
        if (text) {
          lastSuccessfulModelName = candidate.model;
          const durationMs = Date.now() - startTime;
          attemptLogs.push(
            `${candidate.model}${activeThinkingConfig ? '(thinking:0)' : ''}: OK (${((Date.now() - callStart) / 1000).toFixed(2)}s)`
          );
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
            attemptLogs,
          };
        }
      } else {
        lastError = await res.text();
        attemptLogs.push(`${candidate.model}: HTTP ${res.status} (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);

        // Remember unsupported/deprecated/0-quota models so we never waste time calling them again
        if (isModelUnsupportedError(res.status, lastError)) {
          unsupportedModelsCache.add(candidate.model);
          if (lastSuccessfulModelName === candidate.model) {
            lastSuccessfulModelName = null;
          }
        }

        // Early abort ONLY if API Key is definitively invalid
        if (
          res.status === 401 ||
          (res.status === 400 && lastError.includes('API_KEY_INVALID'))
        ) {
          break;
        }

        // If 400 Invalid Argument due to thinkingConfig, retry immediately without thinkingConfig
        if (res.status === 400 && activeThinkingConfig) {
          const retryStart = Date.now();
          const retryGenConfig: Record<string, any> = { temperature };
          if (responseMimeType) retryGenConfig.responseMimeType = responseMimeType;
          if (typeof maxOutputTokens === 'number') retryGenConfig.maxOutputTokens = maxOutputTokens;

          const retryRes = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': cleanApiKey,
            },
            signal: AbortSignal.timeout(candidate.timeoutMs),
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: retryGenConfig,
            }),
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryText = extractTextFromGeminiResponse(retryData);
            if (retryText) {
              lastSuccessfulModelName = candidate.model;
              const durationMs = Date.now() - startTime;
              attemptLogs.push(`${candidate.model}(retry): OK (${((Date.now() - retryStart) / 1000).toFixed(2)}s)`);
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
                attemptLogs,
              };
            }
          }
        }
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      attemptLogs.push(`${candidate.model}: 타임아웃 (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);
      if (lastSuccessfulModelName === candidate.model) {
        lastSuccessfulModelName = null;
      }
    }
  }

  // Dynamic model discovery via Google ModelService.ListModels whenever static candidates fail (unless API key is invalid)
  if (!lastError.includes('API_KEY_INVALID') && !lastError.includes('401')) {
    const fallbackGenConfig: Record<string, any> = { temperature };
    if (responseMimeType) fallbackGenConfig.responseMimeType = responseMimeType;
    if (typeof maxOutputTokens === 'number') fallbackGenConfig.maxOutputTokens = maxOutputTokens;

    const dynamicDiscovery = await autoDiscoverWorkingModelAndCall({
      apiKey: cleanApiKey,
      parts,
      generationConfig: fallbackGenConfig,
      attemptLogs,
    });

    if (dynamicDiscovery && dynamicDiscovery.ok) {
      const durationMs = Date.now() - startTime;
      recordServerUsage({
        isServerKey,
        endpoint,
        model: dynamicDiscovery.modelUsed || 'gemini-auto',
        status: 'ok',
        durationMs,
      });
      return {
        ok: true,
        text: dynamicDiscovery.text,
        rawData: dynamicDiscovery.rawData,
        modelUsed: dynamicDiscovery.modelUsed,
        durationMs,
        attemptLogs,
      };
    } else if (dynamicDiscovery?.lastError) {
      lastError = dynamicDiscovery.lastError;
    }
  }

  // If client-provided key failed due to invalid key or auth error or quota error, and server environment has a fallback key, retry once with server env key
  if (
    serverEnvKey &&
    cleanApiKey !== serverEnvKey &&
    (lastError.includes('API_KEY_INVALID') ||
      lastError.includes('401') ||
      lastError.includes('403') ||
      lastError.includes('quota') ||
      lastError.includes('RESOURCE_EXHAUSTED'))
  ) {
    console.warn('Client-provided Gemini API key failed, falling back to server GEMINI_API_KEY...');
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
    attemptLogs,
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
    maxOutputTokens: 100,
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
