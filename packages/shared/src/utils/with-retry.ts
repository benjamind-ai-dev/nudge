export interface WithRetryOptions {
  /** Number of retry attempts AFTER the first try. Total calls = maxRetries + 1. */
  maxRetries: number;
  /** Base delay in milliseconds. Subsequent delays multiply by `factor`. */
  baseDelayMs: number;
  /** Backoff multiplier. Default 2 (exponential). */
  factor?: number;
  /**
   * Predicate: return false to stop retrying immediately for this error.
   * Default: always retry until maxRetries is reached.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Side-effect callback fired BEFORE each retry (not on the final failure). */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Retry an async operation with exponential backoff.
 *
 * Used for external API calls (QuickBooks, Xero, Resend, Twilio, Claude) where
 * transient failures (5xx, network blips, rate limits with Retry-After) should
 * be retried before propagating. The function rethrows the LAST error after
 * the final attempt — wrap if you need to surface a different error type.
 *
 * Delay schedule for `{ maxRetries: 3, baseDelayMs: 100, factor: 2 }`:
 *   attempt 1 fails → wait 100ms
 *   attempt 2 fails → wait 200ms
 *   attempt 3 fails → wait 400ms
 *   attempt 4 fails → throw
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, factor = 2, shouldRetry, onRetry } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isFinalAttempt = attempt === maxRetries;
      if (isFinalAttempt) break;
      if (shouldRetry && !shouldRetry(error, attempt + 1)) break;
      const delayMs = baseDelayMs * Math.pow(factor, attempt);
      onRetry?.(error, attempt + 1, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
