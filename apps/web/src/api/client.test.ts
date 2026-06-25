import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, setTokenGetter, ApiError, shouldRetryQuery } from "./client";

/** Minimal Response-like object. All ok responses need headers.get for the 204 guard. */
function makeResponse(opts: {
  ok: boolean;
  status?: number;
  headers?: { get: (name: string) => string | null };
  json?: () => Promise<unknown>;
}): Response {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 400),
    headers: opts.headers ?? { get: () => null },
    json: opts.json ?? (async () => ({})),
  } as unknown as Response;
}

describe("apiClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setTokenGetter(async () => null);
  });

  it("makes request to correct URL with base path", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeResponse({ ok: true, json: async () => ({ data: "test" }) }),
    );

    await apiClient("/v1/health");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/health"),
      expect.any(Object)
    );
  });

  it("includes Content-Type header by default", async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeResponse({ ok: true }));

    await apiClient("/test");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("injects Authorization header when tokenGetter returns token", async () => {
    setTokenGetter(async () => "test-token-123");

    vi.mocked(global.fetch).mockResolvedValue(makeResponse({ ok: true }));

    await apiClient("/test");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token-123",
        }),
      })
    );
  });

  it("does not include Authorization header when tokenGetter returns null", async () => {
    setTokenGetter(async () => null);

    vi.mocked(global.fetch).mockResolvedValue(makeResponse({ ok: true }));

    await apiClient("/test");

    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("auth token takes precedence over caller-provided Authorization header", async () => {
    setTokenGetter(async () => "clerk-token");

    vi.mocked(global.fetch).mockResolvedValue(makeResponse({ ok: true }));

    await apiClient("/test", {
      headers: { Authorization: "Bearer attacker-token" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer clerk-token",
        }),
      })
    );
  });

  it("throws error with message from response body on non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeResponse({
        ok: false,
        status: 400,
        json: async () => ({ message: "Invalid input" }),
      }),
    );

    await expect(apiClient("/test")).rejects.toThrow("Invalid input");
  });

  it("throws generic error when response body has no message", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeResponse({ ok: false, status: 500, json: async () => ({}) }),
    );

    await expect(apiClient("/test")).rejects.toThrow("API error: 500");
  });

  // --- 204 No Content + related body-handling tests ---

  it("resolves to undefined for a 204 No Content response and does NOT call json()", async () => {
    const jsonFn = vi.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input"));
    vi.mocked(global.fetch).mockResolvedValue(
      makeResponse({ ok: true, status: 204, json: jsonFn }),
    );

    const result = await apiClient("/v1/templates/abc");

    expect(result).toBeUndefined();
    expect(jsonFn).not.toHaveBeenCalled();
  });

  it("resolves to the parsed JSON body for a 200 OK response", async () => {
    const payload = { data: { id: "123", name: "Test Template" } };
    vi.mocked(global.fetch).mockResolvedValue(
      makeResponse({ ok: true, status: 200, json: async () => payload }),
    );

    const result = await apiClient<typeof payload>("/v1/templates/123");

    expect(result).toEqual(payload);
  });

  it("throws an Error with the server message for a non-ok 400 response", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeResponse({
        ok: false,
        status: 400,
        json: async () => ({ message: "Template not found" }),
      }),
    );

    await expect(apiClient("/v1/templates/bad-id")).rejects.toThrow("Template not found");
  });

  it("throws an ApiError carrying the HTTP status (e.g. 429)", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeResponse({ ok: false, status: 429, json: async () => ({ message: "Too Many Requests" }) }),
    );

    await expect(apiClient("/v1/businesses")).rejects.toMatchObject({
      name: "ApiError",
      status: 429,
      message: "Too Many Requests",
    });
  });
});

describe("shouldRetryQuery", () => {
  it("never retries a 4xx (429 rate limit) — backing off, not hammering", () => {
    expect(shouldRetryQuery(0, new ApiError("Too Many Requests", 429))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("Bad Request", 400))).toBe(false);
  });

  it("retries server errors and unknown/network errors up to 2 times", () => {
    expect(shouldRetryQuery(0, new ApiError("Server", 500))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError("Server", 503))).toBe(true);
    expect(shouldRetryQuery(2, new ApiError("Server", 500))).toBe(false);
    expect(shouldRetryQuery(0, new Error("network down"))).toBe(true);
    expect(shouldRetryQuery(2, new Error("network down"))).toBe(false);
  });
});
