// Administrator configuration and permission checks
export const ADMIN_EMAILS: readonly string[] = [
  'ashstone3@gmail.com',
];

/**
 * Checks if a given email belongs to a system administrator (case-insensitive).
 */
export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === cleanEmail);
}
