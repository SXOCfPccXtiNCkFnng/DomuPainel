const AUTH_KEYS = [
  'domu_is_logged_in',
  'domu_user_email',
  'domu_user_name',
  'domu_tenant_id',
  'domu_is_onboarded',
  'domu_selected_segment',
  'domu_company_name',
  'domu_whatsapp_phone',
  'domu_terms_accepted',
  'domu_platform_ops',
] as const;

export type AuthStorageKey = (typeof AUTH_KEYS)[number];

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function isLoggedIn(): boolean {
  if (!isBrowser()) return false;
  return (
    sessionStorage.getItem('domu_is_logged_in') === 'true' ||
    localStorage.getItem('domu_is_logged_in') === 'true'
  );
}

export function getActiveStorage(): Storage {
  if (!isBrowser()) return localStorage;
  if (sessionStorage.getItem('domu_is_logged_in') === 'true') return sessionStorage;
  if (localStorage.getItem('domu_is_logged_in') === 'true') return localStorage;
  return sessionStorage;
}

export function getAuthItem(key: AuthStorageKey | string): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

export function setAuthItem(key: AuthStorageKey | string, value: string): void {
  if (!isBrowser()) return;
  getActiveStorage().setItem(key, value);
}

export function clearAuthSession(): void {
  if (!isBrowser()) return;
  AUTH_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

export function persistLoginSession(
  data: Record<string, string>,
  rememberMe: boolean
): void {
  if (!isBrowser()) return;

  const target = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;

  AUTH_KEYS.forEach((key) => other.removeItem(key));

  Object.entries(data).forEach(([key, value]) => {
    target.setItem(key, value);
  });
}

export function syncSessionToActiveStorage(data: Record<string, string>): void {
  if (!isBrowser()) return;
  const storage = getActiveStorage();
  Object.entries(data).forEach(([key, value]) => {
    storage.setItem(key, value);
  });
}
