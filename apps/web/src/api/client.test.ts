import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, setTokenGetter } from "./client";

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
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: "test" }),
    } as Response);

    await apiClient("/v1/health");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/health"),
      expect.any(Object)
    );
  });

  it("includes Content-Type header by default", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

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

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

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

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiClient("/test");

    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("auth token takes precedence over caller-provided Authorization header", async () => {
    setTokenGetter(async () => "clerk-token");

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

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
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Invalid input" }),
    } as Response);

    await expect(apiClient("/test")).rejects.toThrow("Invalid input");
  });

  it("throws generic error when response body has no message", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    await expect(apiClient("/test")).rejects.toThrow("API error: 500");
  });
});
