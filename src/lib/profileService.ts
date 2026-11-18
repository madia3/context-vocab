import { getSupabaseClient } from './supabase';
import { User } from '@supabase/supabase-js';

const AVATAR_KEY_PREFIX = 'context_vocab_avatar_';
const NAME_KEY_PREFIX = 'context_vocab_display_name_';

/**
 * Get stored custom avatar data URL (compressed) for a user or guest.
 * Returns null if no custom avatar is saved.
 */
export function getCustomAvatar(userId?: string): string | null {
  if (typeof window === 'undefined') return null;
  const key = `${AVATAR_KEY_PREFIX}${userId || 'guest'}`;
  return localStorage.getItem(key);
}

/**
 * Save custom avatar data URL in localStorage (0MB Supabase Storage used).
 * If null, removes the custom avatar.
 */
export function setCustomAvatar(userId: string | undefined, dataUrl: string | null): void {
  if (typeof window === 'undefined') return;
  const key = `${AVATAR_KEY_PREFIX}${userId || 'guest'}`;
  if (dataUrl) {
    localStorage.setItem(key, dataUrl);
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Get stored custom display name for a user or guest.
 */
export function getCustomDisplayName(userId?: string): string {
  if (typeof window === 'undefined') return '';
  const key = `${NAME_KEY_PREFIX}${userId || 'guest'}`;
  return localStorage.getItem(key) || '';
}

/**
 * Save custom display name locally and optionally sync to Supabase user metadata.
 */
export async function updateProfile(
  currentUser: User | null,
  newDisplayName: string,
  newAvatarDataUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmedName = newDisplayName.trim();

    // 1. Local storage save
    if (typeof window !== 'undefined') {
      const nameKey = `${NAME_KEY_PREFIX}${currentUser?.id || 'guest'}`;
      if (trimmedName) {
        localStorage.setItem(nameKey, trimmedName);
      } else {
        localStorage.removeItem(nameKey);
      }

      if (newAvatarDataUrl !== undefined) {
        setCustomAvatar(currentUser?.id, newAvatarDataUrl);
      }
    }

    // 2. If logged in, update Supabase user metadata (sync across all phones/iPads/PCs)
    const client = getSupabaseClient();
    if (client && currentUser) {
      const updateData: { full_name?: string; custom_avatar?: string | null } = {};
      if (trimmedName) {
        updateData.full_name = trimmedName;
      }
      if (newAvatarDataUrl !== undefined) {
        updateData.custom_avatar = newAvatarDataUrl;
      }
      const { error } = await client.auth.updateUser({
        data: updateData,
      });
      if (error) {
        console.warn('Failed to update Supabase user metadata:', error.message);
      }
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '프로필 저장 중 오류가 발생했습니다.',
    };
  }
}
