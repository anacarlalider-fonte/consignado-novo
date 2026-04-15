const AUTH_TOKEN_KEY = "crm_kato_access_token";

/**
 * Base da API: `VITE_API_BASE_URL` no `.env` do frontend, senão o mesmo host do navegador na porta 3001
 * (assim http://192.168.x.x:5173 chama http://192.168.x.x:3001/api).
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001/api`;
  }
  return "http://localhost:3001/api";
}

/** @deprecated use getApiBaseUrl() — URL fixa quebra ao abrir o site pelo IP da rede. */
export const API_BASE_URL = "http://localhost:3001/api";
const AUTH_CHANGED_EVENT = "crm-auth-changed";

export function setAccessToken(token: string) {
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getAccessToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
}

export function onAuthChanged(handler: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro API GET ${path}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Erro API POST ${path}`);
  return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Erro API PATCH ${path}`);
  return (await res.json()) as T;
}
