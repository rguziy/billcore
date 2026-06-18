const TOKEN_KEY = "billcore_token";
const USER_KEY  = "billcore_user";
const LANG_KEY  = "preferred_language";

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  role: "admin" | "manager" | "operator";
  preferred_language?: string;
}

export function saveAuth(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user.preferred_language) {
    localStorage.setItem(LANG_KEY, user.preferred_language);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getPreferredLanguage(): string {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(LANG_KEY) ?? "en";
}

export function setPreferredLanguage(language: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, language);
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(): boolean {
  return getUser()?.role === "admin";
}

export function isManager(): boolean {
  return getUser()?.role === "manager";
}

export function isManagerOrAbove(): boolean {
  const role = getUser()?.role;
  return role === "admin" || role === "manager";
}

export function defaultPath(): string {
  const role = getUser()?.role;
  if (role === "admin")   return "/users";
  if (role === "manager") return "/statistics";
  return "/clients";
}
