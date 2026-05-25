import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./with-retry";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the result of fn on the first successful call without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toEqual("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and returns the eventual success value", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient 1"))
      .mockRejectedValueOnce(new Error("transient 2"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the LAST error after exhausting all retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValueOnce(new Error("third"))
      .mockRejectedValueOnce(new Error("final"));

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    const expectation = expect(promise).rejects.toThrow("final");
    await vi.runAllTimersAsync();
    await expectation;

    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("applies exponential backoff with the default factor of 2", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    const delays: number[] = [];

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      onRetry: (_error, _attempt, delayMs) => {
        delays.push(delayMs);
      },
    });
    const expectation = expect(promise).rejects.toThrow("nope");
    await vi.runAllTimersAsync();
    await expectation;

    expect(delays).toEqual([100, 200, 400]);
  });

  it("honours a custom backoff factor", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    const delays: number[] = [];

    const promise = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 50,
      factor: 3,
      onRetry: (_error, _attempt, delayMs) => {
        delays.push(delayMs);
      },
    });
    const expectation = expect(promise).rejects.toThrow("nope");
    await vi.runAllTimersAsync();
    await expectation;

    expect(delays).toEqual([50, 150]);
  });

  it("stops retrying when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));

    // shouldRetry returning false means no timer fires at all — synchronous reject path.
    await expect(
      withRetry(fn, {
        maxRetries: 5,
        baseDelayMs: 10,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow("fatal");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invokes onRetry with the error, attempt number, and delay before each retry", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("e1"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 25,
      onRetry,
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: "e1" }),
      1,
      25,
    );
  });

  it("does NOT invoke onRetry after the final failed attempt", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error("nope"));

    const promise = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 10,
      onRetry,
    });
    const expectation = expect(promise).rejects.toThrow("nope");
    await vi.runAllTimersAsync();
    await expectation;

    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
