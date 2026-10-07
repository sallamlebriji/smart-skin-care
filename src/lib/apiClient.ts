/**
 * Thin fetch wrapper around the FastAPI backend (see /backend). Phase 1
 * ships this client unused by any live UI — it exists so Phase 2+ can wire
 * real requests without inventing a new pattern each time.
 */

import { useAuthStore } from "@/store/useAuthStore";
export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const options: RequestInit = {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(useAuthStore.getState().user ? { "X-Account-Session": "true" } : {}),
      ...init?.headers,
    },
  };
  let res = await fetch(`${BASE_URL}${path}`, options);
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    if (await refreshSession()) res = await fetch(`${BASE_URL}${path}`, options);
  }

  if (!res.ok) {
    throw await responseError(res);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  // No Content-Type header: the browser must set the multipart boundary itself.
  const options: RequestInit = { method: "POST", body, credentials: "include", headers: useAuthStore.getState().user ? { "X-Account-Session": "true" } : {} };
  let res = await fetch(`${BASE_URL}${path}`, options);
  if (res.status === 401 && await refreshSession()) {
    res = await fetch(`${BASE_URL}${path}`, options);
  }
  if (!res.ok) {
    throw await responseError(res);
  }
  return (await res.json()) as T;
}

let refreshPromise: Promise<boolean> | null = null;
async function refreshSession() {
  refreshPromise ??= fetch(`${BASE_URL}/api/auth/refresh`, { method: "POST", credentials: "include" })
    .then((res) => res.ok).catch(() => false).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function responseError(res: Response) {
  const body = await res.json().catch(() => null);
  const message = typeof body?.detail === "string" ? body.detail : Array.isArray(body?.detail)
    ? body.detail.map((item: { msg: string }) => item.msg).join("; ") : res.statusText;
  return new ApiError(res.status, message);
}

export const apiClient = {
  postForm: <T>(path: string, body: FormData) => requestForm<T>(path, body),
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
