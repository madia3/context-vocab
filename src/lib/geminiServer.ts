import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { isUserAdmin } from '@/lib/admin';

// Shared server-side Gemini API model configuration, rate limiter & fast fallback caller
// Optimized to remember the fastest working model and avoid sequential timeout cascades

export const SERVER_KEY_DAILY_QUOTAS = {
  guest: 20,           // 비로그인(게스트): 일 20회
  member: 50,          // 로그인 회원(개인 키 미등록): 일 50회
  personalBackup: 100, // 개인 키 등록 회원(본인 키 1,500회 소진 시 비상 서버 키): +100회
  personalOwn: 1500,   // 개인 무료 키 일일 한도(Google 무료 티어 기준): 1,500회
} as const;

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

// Per-User Daily Quota Tracker for Server-Key Usage (persisted in /tmp, resets daily at KST midnight)
const USER_QUOTA_FILE_PATH = path.join('/tmp', 'cv_user_daily_quota.json');

interface PersistedUserQuotas {
  dateKst: string;
  counts: Record<string, number>;
}

let memoryUserQuotas: PersistedUserQuotas | null = null;

function getTodayKstDate(): string {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kstNow.toISOString().slice(0, 10);
}

function loadUserQuotas(): PersistedUserQuotas {
  const today = getTodayKstDate();
  if (memoryUserQuotas && memoryUserQuotas.dateKst === today) {
    return memoryUserQuotas;
  }
  try {
    if (fs.existsSync(USER_QUOTA_FILE_PATH)) {
      const raw = fs.readFileSync(USER_QUOTA_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as PersistedUserQuotas;
      if (parsed && parsed.dateKst === today && parsed.counts) {
        memoryUserQuotas = parsed;
        return parsed;
      }
    }
  } catch {}
  memoryUserQuotas = { dateKst: today, counts: {} };
  return memoryUserQuotas;
}

function saveUserQuotas(data: PersistedUserQuotas) {
  memoryUserQuotas = data;
  try {
    fs.writeFileSync(USER_QUOTA_FILE_PATH, JSON.stringify(data), 'utf8');
  } catch {}
}

export function checkAndConsumeServerKeyQuota(
  req: Request,
  options?: { isPersonalKeyFallback?: boolean }
): {
  allowed: boolean;
  tier: 'admin' | 'personal_backup' | 'member' | 'guest';
  limit: number;
  used: number;
  remaining: number;
  message?: string;
} {
  try {
    const userEmail = (req.headers.get('x-user-email') || '').trim();
    const userId = (req.headers.get('x-user-id') || '').trim();
    const hasPersonalKey =
      Boolean(options?.isPersonalKeyFallback) || req.headers.get('x-has-personal-key') === '1';

    if (isUserAdmin(userEmail)) {
      return { allowed: true, tier: 'admin', limit: 999999, used: 0, remaining: 999999 };
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'anonymous';
    const subjectKey = userId ? `uid:${userId}` : `ip:${ip}`;

    let tier: 'personal_backup' | 'member' | 'guest' = 'guest';
    let limit: number = SERVER_KEY_DAILY_QUOTAS.guest;
    if (hasPersonalKey) {
      tier = 'personal_backup';
      limit = SERVER_KEY_DAILY_QUOTAS.personalBackup;
    } else if (userId) {
      tier = 'member';
      limit = SERVER_KEY_DAILY_QUOTAS.member;
    }

    const store = loadUserQuotas();
    const currentUsed = store.counts[subjectKey] || 0;

    if (currentUsed >= limit) {
      const tierLabel =
        tier === 'guest'
          ? `비로그인 일일 무료 한도(${limit}회)`
          : tier === 'member'
          ? `로그인 회원 무료 서버 한도(${limit}회)`
          : `개인 키 소진 후 비상 서버 한도(${limit}회)`;
      const guideMsg =
        tier === 'personal_backup'
          ? `오늘의 ${tierLabel}를 모두 사용했습니다. 내일 자정(KST)에 자동 초기화됩니다.`
          : `오늘의 ${tierLabel}를 모두 사용했습니다. 설정 > AI 연동에서 무료 개인 API 키를 등록하시면 매일 1,500회 + 비상 100회까지 이용하실 수 있습니다.`;
      return {
        allowed: false,
        tier,
        limit,
        used: currentUsed,
        remaining: 0,
        message: guideMsg,
      };
    }

    store.counts[subjectKey] = currentUsed + 1;
    saveUserQuotas(store);

    return {
      allowed: true,
      tier,
      limit,
      used: currentUsed + 1,
      remaining: Math.max(0, limit - (currentUsed + 1)),
    };
  } catch {
    return { allowed: true, tier: 'guest', limit: SERVER_KEY_DAILY_QUOTAS.guest, used: 0, remaining: SERVER_KEY_DAILY_QUOTAS.guest };
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
  if (clean === 'gemini-3.5-flash-lite') return 99;
  if (clean === 'gemini-3.1-flash-lite') return 98;
  if (clean === 'gemini-3.1-flash-lite-preview') return 97;
  if ((clean.includes('gemini-3') || clean.includes('gemini-4')) && clean.includes('flash-lite')) return 96;
  if ((clean.includes('gemini-3') || clean.includes('gemini-4')) && clean.includes('flash')) return 92;
  if (clean === 'gemini-flash-latest') return 85;
  if (clean.includes('2.5')) return 15; // deprecated for new users
  if (clean.includes('2.0') && clean.includes('flash')) return 20;
  if (clean.includes('1.5') && clean.includes('flash')) return 10;
  if (clean.includes('flash')) return 40;
  return 5;
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

// Cache discovered live models per API key for 10 minutes so ListModels takes 0.00s on subsequent calls
const discoveredModelsCache = new Map<string, { models: GeminiModelCandidate[]; fetchedAt: number }>();
const DISCOVERED_CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchLiveOrderedModels(
  apiKey: string,
  attemptLogs?: string[]
): Promise<GeminiModelCandidate[]> {
  const cacheKey = apiKey.slice(0, 12);
  const now = Date.now();
  const cached = discoveredModelsCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < DISCOVERED_CACHE_TTL_MS && cached.models.length > 0) {
    return cached.models.filter((m) => !unsupportedModelsCache.has(m.model));
  }

  for (const ver of ['v1beta', 'v1'] as const) {
    const listStart = Date.now();
    try {
      const listUrl = `https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(apiKey)}`;
      const listRes = await fetch(listUrl, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(3500),
      });
      if (!listRes.ok) {
        attemptLogs?.push(`ListModels(${ver}): HTTP ${listRes.status} (${((Date.now() - listStart) / 1000).toFixed(2)}s)`);
        continue;
      }

      const listData = await listRes.json();
      const rawModels: any[] = listData.models || [];
      const supported = rawModels
        .filter(
          (m) =>
            m?.name &&
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            isTextCapableGeminiModel(m.name)
        )
        .sort((a, b) => scoreDiscoveredModel(b.name) - scoreDiscoveredModel(a.name))
        .map((m) => ({
          model: String(m.name).replace(/^models\//, ''),
          apiVersion: ver,
          timeoutMs: 9500,
        }));

      if (supported.length > 0) {
        discoveredModelsCache.set(cacheKey, { models: supported, fetchedAt: Date.now() });
        attemptLogs?.push(`ListModels(${ver}): ${supported.length}개 대기 (${((Date.now() - listStart) / 1000).toFixed(2)}s)`);
        return supported.filter((m) => !unsupportedModelsCache.has(m.model));
      }
    } catch {
      // ignore discovery error and fall back to static candidates
    }
  }
  return [];
}

export async function callGeminiWithFallback(options: {
  apiKey: string;
  parts: any[];
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  candidates?: GeminiModelCandidate[];
  endpoint?: string;
  req?: Request;
}): Promise<{
  ok: boolean;
  text: string;
  rawData?: any;
  modelUsed?: string;
  lastError?: string;
  quotaExceeded?: boolean;
  quotaInfo?: { tier: string; used: number; limit: number };
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
    req,
  } = options;

  const startTime = Date.now();
  const attemptLogs: string[] = [];
  const cleanApiKey = (apiKey || '').trim();
  const serverEnvKey = process.env.GEMINI_API_KEY?.trim() || '';
  const isServerKey = Boolean(serverEnvKey && cleanApiKey === serverEnvKey);

  if (!cleanApiKey) {
    return { ok: false, text: '', lastError: 'API 키가 비어있습니다.', attemptLogs };
  }

  // 서버 공용 키를 사용할 때는 사용자 등급별 일일 한도 검사 (비로그인 20회 / 로그인 50회 / 개인키 비상 +100회 / 관리자 무제한)
  if (isServerKey && req) {
    const quota = checkAndConsumeServerKeyQuota(req, {
      isPersonalKeyFallback: endpoint.endsWith('-fallback'),
    });
    if (!quota.allowed) {
      attemptLogs.push(`서버 키 일일 한도 초과 (${quota.used}/${quota.limit}회)`);
      return {
        ok: false,
        text: '',
        lastError: quota.message || '오늘의 무료 서버 AI 한도를 모두 사용했습니다.',
        quotaExceeded: true,
        quotaInfo: { tier: quota.tier, used: quota.used, limit: quota.limit },
        durationMs: 0,
        attemptLogs,
      };
    }
  }

  // Restore last known working model from persisted usage if memory is cold
  if (!lastSuccessfulModelName) {
    const persistedModel = loadServerUsage().lastActiveModel;
    if (persistedModel && !unsupportedModelsCache.has(persistedModel)) {
      lastSuccessfulModelName = persistedModel;
    }
  }

  // Build initial priority candidate pool (gemini-flash-lite-latest at #1)
  const candidatePool: GeminiModelCandidate[] = [];
  const addCandidateToPool = (c: GeminiModelCandidate) => {
    if (!c.model || unsupportedModelsCache.has(c.model)) return;
    if (!candidatePool.some((x) => x.model === c.model)) {
      candidatePool.push(c);
    }
  };

  if (lastSuccessfulModelName && !unsupportedModelsCache.has(lastSuccessfulModelName)) {
    addCandidateToPool({
      model: lastSuccessfulModelName,
      apiVersion: 'v1beta',
      timeoutMs: 9500,
    });
  }
  candidates.forEach(addCandidateToPool);

  // Start ListModels in parallel at t=0.00s (non-blocking) so live models are ready if 1st model errors, is absent from list, or exceeds 3.0s
  let liveModelsMerged = false;
  let onLiveModelsReady: ((liveList: GeminiModelCandidate[]) => void) | null = null;
  const liveModelsPromise = fetchLiveOrderedModels(cleanApiKey, attemptLogs).then((liveList) => {
    if (liveList.length > 0) {
      // Replace candidatePool with verified live models sorted by speed so no non-existent model is ever called
      candidatePool.length = 0;
      liveList.forEach(addCandidateToPool);
    }
    liveModelsMerged = true;
    if (onLiveModelsReady) {
      onLiveModelsReady(liveList);
    }
    return liveList;
  });

  const STAGGER_INTERVAL_MS = 3000; // 3.0초 내 응답 없으면 다음 살아있는 모델을 병렬로 즉시 추가 투입
  const MAX_PARALLEL_MODELS = 4;

  const raceResult = await new Promise<{
    ok: boolean;
    text: string;
    rawData?: any;
    modelUsed?: string;
    lastError?: string;
  }>((resolveRace) => {
    let resolved = false;
    let inFlightCount = 0;
    let fatalAuthError = false;
    let latestError = '';
    const launchedModels = new Set<string>();
    const activeControllers = new Set<AbortController>();
    const activeTimers = new Set<ReturnType<typeof setTimeout>>();

    const cleanupAll = () => {
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
      activeControllers.forEach((ctrl) => {
        try {
          ctrl.abort();
        } catch {}
      });
      activeControllers.clear();
    };

    const pickNextCandidate = (): GeminiModelCandidate | null => {
      for (const c of candidatePool) {
        if (!launchedModels.has(c.model) && !unsupportedModelsCache.has(c.model)) {
          return c;
        }
      }
      return null;
    };

    // 목록(ListModels)이 도착했을 때, 처음에 병렬로 먼저 쏜 모델이 가능 리스트에 없으면 3초를 기다리지 않고 즉시(0.08초 시점) 리스트 1순위 모델을 바로 투입!
    onLiveModelsReady = (liveList: GeminiModelCandidate[]) => {
      if (resolved || fatalAuthError || liveList.length === 0) return;
      const liveSet = new Set(liveList.map((m) => m.model));
      const missingLaunched = Array.from(launchedModels).filter((m) => !liveSet.has(m));
      if (missingLaunched.length > 0) {
        missingLaunched.forEach((m) => {
          unsupportedModelsCache.add(m);
          if (lastSuccessfulModelName === m) {
            lastSuccessfulModelName = null;
          }
        });
        const hasAnyValidInFlight = Array.from(launchedModels).some((m) => liveSet.has(m));
        if (!hasAnyValidInFlight) {
          attemptLogs.push(`${missingLaunched.join(',')}: 가능 목록에 없음 ➔ 3초 대기 없이 즉시 차순위 투입`);
          void launchNextModel();
        }
      }
    };

    // 전체 레이스 안전 타임아웃 (15초): 어떤 상황에서도 서버 함수가 60초까지 행(hang) 걸리지 않도록 보장
    const globalRaceTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanupAll();
        attemptLogs.push('전체 레이스 제한시간(15s) 초과');
        resolveRace({ ok: false, text: '', lastError: latestError || 'AI 응답 제한시간(15초) 초과' });
      }
    }, 15000);
    activeTimers.add(globalRaceTimeout);

    const launchNextModel = async () => {
      if (resolved || fatalAuthError) {
        return;
      }

      if (launchedModels.size >= MAX_PARALLEL_MODELS) {
        if (inFlightCount === 0 && !resolved) {
          resolved = true;
          cleanupAll();
          resolveRace({ ok: false, text: '', lastError: latestError || '모든 병렬 후보 모델 응답 실패' });
        }
        return;
      }

      let candidate = pickNextCandidate();
      if (!candidate && !liveModelsMerged) {
        await liveModelsPromise;
        if (resolved || fatalAuthError) return;
        candidate = pickNextCandidate();
      }

      if (!candidate) {
        if (inFlightCount === 0 && !resolved) {
          resolved = true;
          cleanupAll();
          resolveRace({ ok: false, text: '', lastError: latestError || '사용 가능한 Gemini 모델을 찾지 못했습니다.' });
        }
        return;
      }

      launchedModels.add(candidate.model);
      inFlightCount += 1;

      const controller = new AbortController();
      activeControllers.add(controller);

      // Per-model hard timeout (9.5s)
      const hardTimeout = setTimeout(() => {
        try {
          controller.abort();
        } catch {}
      }, candidate.timeoutMs || 9500);
      activeTimers.add(hardTimeout);

      // 3.0초(3000ms) 헤징 타이머: 3초 내에 현재 모델이 안 끝나면 끊지 않고 차순위 살아있는 모델을 병렬로 추가 출발!
      const staggerTimer = setTimeout(() => {
        activeTimers.delete(staggerTimer);
        if (!resolved && !fatalAuthError && launchedModels.size < MAX_PARALLEL_MODELS) {
          attemptLogs.push(`${candidate!.model}: 3.0s 경과 ➔ 차순위 병렬투입`);
          void launchNextModel();
        }
      }, STAGGER_INTERVAL_MS);
      activeTimers.add(staggerTimer);

      const callStart = Date.now();
      try {
        const apiVer = candidate.apiVersion || 'v1beta';
        const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${candidate.model}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;
        const generationConfig: Record<string, any> = { temperature };
        if (responseMimeType) generationConfig.responseMimeType = responseMimeType;
        if (typeof maxOutputTokens === 'number') generationConfig.maxOutputTokens = maxOutputTokens;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanApiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig,
          }),
        });

        clearTimeout(staggerTimer);
        activeTimers.delete(staggerTimer);
        clearTimeout(hardTimeout);
        activeTimers.delete(hardTimeout);
        activeControllers.delete(controller);

        if (resolved) return;

        if (res.ok) {
          const data = await res.json();
          const text = extractTextFromGeminiResponse(data);
          if (text && !resolved) {
            resolved = true;
            lastSuccessfulModelName = candidate.model;
            attemptLogs.push(`${candidate.model}: OK (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);
            cleanupAll();
            resolveRace({
              ok: true,
              text,
              rawData: data,
              modelUsed: candidate.model,
            });
            return;
          } else {
            const finishReason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'EMPTY';
            latestError = `${candidate.model} 빈 응답 (${finishReason})`;
            attemptLogs.push(`${candidate.model}: 빈 응답[${finishReason}] (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);
          }
        } else {
          const errText = await res.text();
          latestError = errText;
          attemptLogs.push(`${candidate.model}: HTTP ${res.status} (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);

          if (isModelUnsupportedError(res.status, errText)) {
            unsupportedModelsCache.add(candidate.model);
            if (lastSuccessfulModelName === candidate.model) {
              lastSuccessfulModelName = null;
            }
          }

          if (res.status === 401 || (res.status === 400 && errText.includes('API_KEY_INVALID'))) {
            fatalAuthError = true;
            if (!resolved) {
              resolved = true;
              cleanupAll();
              resolveRace({ ok: false, text: '', lastError: errText });
            }
            return;
          }
        }
      } catch (err: any) {
        clearTimeout(staggerTimer);
        activeTimers.delete(staggerTimer);
        clearTimeout(hardTimeout);
        activeTimers.delete(hardTimeout);
        activeControllers.delete(controller);

        if (!resolved) {
          latestError = err?.message || String(err);
          attemptLogs.push(`${candidate.model}: 타임아웃/에러 (${((Date.now() - callStart) / 1000).toFixed(2)}s)`);
          if (lastSuccessfulModelName === candidate.model) {
            lastSuccessfulModelName = null;
          }
        }
      } finally {
        inFlightCount -= 1;
        if (!resolved && !fatalAuthError) {
          // 에러가 났을 때는 3초를 기다리지 않고 즉시 다음 살아있는 모델 투입!
          void launchNextModel();
        }
      }
    };

    // t = 0.00s: 1순위 모델(gemini-flash-lite-latest) 즉시 출발
    void launchNextModel();
  });

  if (raceResult.ok && raceResult.text) {
    const durationMs = Date.now() - startTime;
    recordServerUsage({
      isServerKey,
      endpoint,
      model: raceResult.modelUsed || 'gemini-flash-lite-latest',
      status: 'ok',
      durationMs,
    });
    return {
      ok: true,
      text: raceResult.text,
      rawData: raceResult.rawData,
      modelUsed: raceResult.modelUsed,
      durationMs,
      attemptLogs,
    };
  }

  const lastError = raceResult.lastError || '';

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
    model: candidatePool[0]?.model || 'gemini',
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
