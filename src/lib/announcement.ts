export interface AppAnnouncement {
  id: string;
  active: boolean;
  type: 'info' | 'warning' | 'update';
  message: string;
  linkText?: string;
  linkUrl?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'cv_global_announcement_v1';
export const ANNOUNCEMENT_CHANGED_EVENT = 'cv_announcement_changed';

const DEFAULT_ANNOUNCEMENT: AppAnnouncement = {
  id: 'notice-welcome',
  active: false,
  type: 'info',
  message: 'Google Gemini AI 전역 연동 완료: 사진 고정밀 OCR 및 자동 문장 번역이 제공됩니다.',
  updatedAt: Date.now(),
};

export function getStoredAnnouncement(): AppAnnouncement {
  if (typeof window === 'undefined') return DEFAULT_ANNOUNCEMENT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ANNOUNCEMENT;
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id || 'notice-1',
      active: Boolean(parsed.active),
      type: parsed.type || 'info',
      message: parsed.message || '',
      linkText: parsed.linkText,
      linkUrl: parsed.linkUrl,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return DEFAULT_ANNOUNCEMENT;
  }
}

export function saveStoredAnnouncement(announcement: AppAnnouncement) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(announcement));
    window.dispatchEvent(new CustomEvent(ANNOUNCEMENT_CHANGED_EVENT, { detail: announcement }));
  } catch (err) {
    console.error('Failed to save announcement:', err);
  }
}
