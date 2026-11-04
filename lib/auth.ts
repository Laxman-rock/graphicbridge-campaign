import { User, AuthSession } from '@/types/auth';

const AUTH_STORAGE_KEY = 'campaign_auth_session';

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearAuthSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveAuthSession(token: string, user: User, remember: boolean = true): void {
  if (typeof window === 'undefined') return;
  const session: AuthSession = {
    token,
    user,
    // If remember is true, retain for 7 days; otherwise 1 day
    expiresAt: Date.now() + (remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  // Also set a document cookie for middleware/SSR safety
  document.cookie = `campaign_auth_token=${token}; path=/; max-age=${remember ? 7 * 86400 : 86400}; SameSite=Lax`;
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.cookie = 'campaign_auth_token=; path=/; max-age=0; SameSite=Lax';
}

export function isAuthenticated(): boolean {
  return !!getAuthSession()?.token;
}

export function getStoredUser(): User | null {
  return getAuthSession()?.user || null;
}

export function getAuthToken(): string | null {
  return getAuthSession()?.token || null;
}

