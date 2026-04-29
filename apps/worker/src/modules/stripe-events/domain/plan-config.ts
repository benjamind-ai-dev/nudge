import type { BillingPlan } from "./account-billing.entity";

export interface PlanMeta {
  plan: BillingPlan;
  maxBusinesses: number;
}

export const PLAN_META: Record<BillingPlan, PlanMeta> = {
  starter: { plan: "starter", maxBusinesses: 1 },
  growth: { plan: "growth", maxBusinesses: 1 },
  agency: { plan: "agency", maxBusinesses: 5 },
};

export interface PlanConfigService {
  resolveByPriceId(priceId: string): PlanMeta | null;
}

export const PLAN_CONFIG_SERVICE = Symbol("PlanConfigService");
