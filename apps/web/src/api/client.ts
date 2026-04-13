const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/v1";

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
