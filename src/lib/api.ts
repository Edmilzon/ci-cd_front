const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

type ApiOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

/** Small shared fetch wrapper for the Spring Boot API. */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const configuredUrl = typeof window === "undefined" ? null : window.localStorage.getItem("cdci.apiBaseUrl");
  const baseUrl = configuredUrl?.replace(/\/+$/, "") || API_BASE_URL;
  const response = await fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`La API respondió ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };
