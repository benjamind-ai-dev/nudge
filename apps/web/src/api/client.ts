const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn;
}

/** Error thrown by `apiClient` on a non-ok response. Carries the HTTP status so
 *  callers (and the TanStack Query retry policy) can branch on it — notably to
 *  STOP retrying 4xx like 429, which otherwise multiplies a rate-limit trip. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Default TanStack Query retry policy. Never retry client errors (4xx) — a 429
 * rate-limit must back off, not hammer; retrying it deepens the spiral. Retry
 * transient server/network errors a couple of times.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await tokenGetter?.();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? `API error: ${response.status}`, response.status);
  }

  if (response.status === 204 || response.headers.get("Content-Length") === "0") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
