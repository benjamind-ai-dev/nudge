/**
 * Rate limit configuration for the API.
 *
 * Tune values here only — controllers reference these constants so changes
 * propagate to every decorated route. TTL is milliseconds (per @nestjs/throttler v5+).
 *
 * Bucket selection:
 * - DEFAULT — every route that isn't otherwise decorated.
 * - WEBHOOKS — `v1/webhooks/*` controllers. Providers (Stripe, Twilio, etc.)
 *   send bursts; 500/min absorbs that without dropping legitimate deliveries.
 * - AUTH — OAuth initiation + callback routes. The only unauthenticated,
 *   state-mutating entry points; tightened to deter brute-forcing of the
 *   OAuth `state` parameter.
 */
export const RATE_LIMITS = {
  DEFAULT: { limit: 100, ttl: 60_000 },
  WEBHOOKS: { limit: 500, ttl: 60_000 },
  AUTH: { limit: 10, ttl: 60_000 },
} as const;

export const RATE_LIMIT_NAMES = {
  DEFAULT: "default",
  WEBHOOKS: "webhooks",
  AUTH: "auth",
} as const;
