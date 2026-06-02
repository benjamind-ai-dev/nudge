/**
 * Per-plan entitlement limits — single source of truth for both API and worker.
 *
 * Enforced at write boundaries (seats on invite, sequences on create). `sms`
 * gates the SMS channel. `maxBusinesses` mirrors the worker plan config but is
 * NOT enforced yet (multi-business UI is a v1.1 follow-up).
 */

export type BillingPlan = "starter" | "growth" | "agency";

export interface PlanLimits {
  /** Max team members (incl. owner) on the account. */
  maxSeats: number;
  /** Max follow-up sequences per business. */
  maxSequencesPerBusiness: number;
  /** Whether SMS reminder steps are allowed. */
  sms: boolean;
  /** Max connected businesses per account (not enforced in v1). */
  maxBusinesses: number;
}

export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  starter: {
    maxSeats: 1,
    maxSequencesPerBusiness: 2,
    sms: false,
    maxBusinesses: 1,
  },
  growth: {
    maxSeats: 5,
    maxSequencesPerBusiness: 10,
    sms: true,
    maxBusinesses: 1,
  },
  agency: {
    maxSeats: 15,
    maxSequencesPerBusiness: Number.MAX_SAFE_INTEGER,
    sms: true,
    maxBusinesses: 5,
  },
};

/** Floor used when an account has no resolved plan (most restrictive). */
export const DEFAULT_PLAN_LIMITS: PlanLimits = PLAN_LIMITS.starter;

export function limitsForPlan(plan: BillingPlan | null | undefined): PlanLimits {
  return plan ? PLAN_LIMITS[plan] : DEFAULT_PLAN_LIMITS;
}
