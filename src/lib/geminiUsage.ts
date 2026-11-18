/**
 * Tracks client-side Gemini API quota and usage statistics against Google AI Studio Free Tier limits.
 * Free tier baseline: 1,500 Requests Per Day (RPD) and 15 Requests Per Minute (RPM).
 */

export const FREE_TIER_DAILY_LIMIT = 1500;
export const FREE_TIER_RPM_LIMIT = 15;
const STORAGE_KEY = 'cv_gemini_usage_v1';
export const AI_USAGE_EVENT = 'cv_ai_usage_changed';

export interface AiUsageStats {
  todayDate: string;
  usedCount: number;
  dailyLimit: number;
  remainingCount: number;
  usedPercent: number;
  remainingPercent: number;
  rpmLimit: number;
  lastUpdated: number;
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAiUsageStats(): AiUsageStats {
  const today = getTodayString();
  const fallback: AiUsageStats = {
    todayDate: today,
    usedCount: 0,
    dailyLimit: FREE_TIER_DAILY_LIMIT,
    remainingCount: FREE_TIER_DAILY_LIMIT,
    usedPercent: 0,
    remainingPercent: 100,
    rpmLimit: FREE_TIER_RPM_LIMIT,
    lastUpdated: Date.now(),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (parsed.todayDate !== today) {
      // New day: reset usage
      const resetStats: AiUsageStats = {
        ...fallback,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resetStats));
      return resetStats;
    }

    const usedCount = Math.max(0, Number(parsed.usedCount) || 0);
    const dailyLimit = FREE_TIER_DAILY_LIMIT;
    const remainingCount = Math.max(0, dailyLimit - usedCount);
    const usedPercent = Math.min(100, Math.round((usedCount / dailyLimit) * 100));
    const remainingPercent = Math.max(0, 100 - usedPercent);

    return {
      todayDate: today,
      usedCount,
      dailyLimit,
      remainingCount,
      usedPercent,
      remainingPercent,
      rpmLimit: FREE_TIER_RPM_LIMIT,
      lastUpdated: Number(parsed.lastUpdated) || Date.now(),
    };
  } catch {
    return fallback;
  }
}

export function recordAiUsage(increment: number = 1): AiUsageStats {
  const current = getAiUsageStats();
  const nextUsed = current.usedCount + Math.max(1, increment);
  const remainingCount = Math.max(0, current.dailyLimit - nextUsed);
  const usedPercent = Math.min(100, Math.round((nextUsed / current.dailyLimit) * 100));
  const remainingPercent = Math.max(0, 100 - usedPercent);

  const updated: AiUsageStats = {
    ...current,
    usedCount: nextUsed,
    remainingCount,
    usedPercent,
    remainingPercent,
    lastUpdated: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(AI_USAGE_EVENT, { detail: updated }));
    } catch {
      // ignore storage errors
    }
  }

  return updated;
}
