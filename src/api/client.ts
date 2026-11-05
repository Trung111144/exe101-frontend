import type { ProblemDetail } from './types';

// In development Vite proxies /api to the Spring Boot backend (see vite.config.ts), so the browser never makes a
// cross-origin call. Set VITE_API_BASE to call the backend directly once it allows CORS.
export const API_BASE: string = (import.meta as any).env?.VITE_API_BASE ?? '/api';

export type SessionKind = 'customer' | 'staff';
export interface Session { kind: SessionKind; token: string; expiresAt: number }

const storageKey = 'exe101.session';
let session: Session | null = readSession();
const listeners = new Set<() => void>();

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (session && session.expiresAt <= Date.now()) setSession(null);
  return session;
}

export function setSession(next: Session | null) {
  session = next;
  try {
    if (next) localStorage.setItem(storageKey, JSON.stringify(next));
    else localStorage.removeItem(storageKey);
  } catch {
    /* storage unavailable: keep the session in memory only */
  }
  listeners.forEach((listener) => listener());
}

export function onSessionChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class ApiError extends Error {
  status: number;
  code: string;
  problem: ProblemDetail | null;

  constructor(status: number, problem: ProblemDetail | null, fallback: string) {
    super(problem?.detail || fallback);
    this.status = status;
    this.code = problem?.errorCode ?? (status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`);
    this.problem = problem;
  }
}

type Body = unknown;
interface RequestOptions { method?: string; body?: Body; form?: FormData; query?: Record<string, unknown>; raw?: boolean }

function buildUrl(path: string, query?: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json, application/problem+json, */*' };
  const current = getSession();
  if (current) headers.Authorization = `Bearer ${current.token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), { method: options.method ?? 'GET', headers, body });
  } catch {
    throw new ApiError(0, null, 'Không kết nối được máy chủ. Kiểm tra backend đã chạy ở cổng 8080 chưa.');
  }

  if (!response.ok) {
    let problem: ProblemDetail | null = null;
    try {
      problem = (await response.json()) as ProblemDetail;
    } catch {
      problem = null;
    }
    // An expired or revoked token: drop the session so the UI asks the person to sign in again.
    if (response.status === 401 && current) setSession(null);
    throw new ApiError(response.status, problem, `Yêu cầu thất bại (HTTP ${response.status}).`);
  }
  return response;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const get = <T>(path: string, query?: Record<string, unknown>) => api<T>(path, { query });
export const post = <T>(path: string, body?: Body) => api<T>(path, { method: 'POST', body: body ?? {} });
export const put = <T>(path: string, body?: Body) => api<T>(path, { method: 'PUT', body });
export const del = <T = void>(path: string) => api<T>(path, { method: 'DELETE' });
export const postForm = <T>(path: string, form: FormData, query?: Record<string, unknown>) =>
  api<T>(path, { method: 'POST', form, query });

// Spring's @RequestPart DTOs need the JSON part sent with an application/json content type.
export function jsonPart(value: unknown) {
  return new Blob([JSON.stringify(value)], { type: 'application/json' });
}

export async function fetchBlob(path: string): Promise<{ blob: Blob; fileName: string | null }> {
  const response = await send(path);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  const fileName = match ? decodeURIComponent(match[1] ?? match[2]) : null;
  return { blob: await response.blob(), fileName };
}

export async function downloadFile(path: string, fallbackName: string) {
  const { blob, fileName } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
