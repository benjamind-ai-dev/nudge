const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn;
}

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await tokenGetter?.();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
