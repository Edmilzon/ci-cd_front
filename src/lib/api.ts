const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

type ApiOptions = Omit<RequestInit, "headers"> & { headers?: HeadersInit };

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(status: number, message: string, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function apiBaseUrl() {
  const configuredUrl = typeof window === "undefined" ? null : window.localStorage.getItem("cdci.apiBaseUrl");
  return configuredUrl?.replace(/\/+$/, "") || API_BASE_URL;
}

async function getCsrfToken() {
  const response = await fetch(`${apiBaseUrl()}/api/auth/csrf`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new ApiError(response.status, "No se pudo iniciar una solicitud segura.");
  const body = (await response.json()) as { token: string };
  return body.token;
}

/** Shared client for Spring Boot. Session cookies remain HttpOnly in the browser. */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    headers.set("X-XSRF-TOKEN", await getCsrfToken());
  }

  const response = await fetch(`${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string; message?: string; fields?: Record<string, string> } | null;
    throw new ApiError(response.status, body?.message ?? `La API respondió ${response.status}.`, body?.code, body?.fields);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  createdAt?: string | null;
  permissions: string[];
};

export async function login(email: string, password: string) {
  const body = new URLSearchParams({ email, password });
  return apiFetch<{ authenticated: boolean }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function registerAccount(input: { email: string; fullName: string; password: string }) {
  return apiFetch<AuthUser>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser() {
  return apiFetch<AuthUser>("/api/auth/me");
}

export async function logout() {
  return apiFetch<void>("/api/auth/logout", { method: "POST" });
}

export { API_BASE_URL };
