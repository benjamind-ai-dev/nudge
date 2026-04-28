import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../common/config/env.schema";
import {
  PLAN_META,
  type PlanConfigService,
  type PlanMeta,
} from "../domain/plan-config";
import type { BillingPlan } from "../domain/account-billing.entity";

@Injectable()
export class ConfigPlanConfigService implements PlanConfigService {
  private readonly priceToMeta: Map<string, PlanMeta>;

  constructor(config: ConfigService<Env, true>) {
    const priceMap: Record<BillingPlan, string> = {
      starter: config.get("STRIPE_PRICE_STARTER", { infer: true }),
      growth: config.get("STRIPE_PRICE_GROWTH", { infer: true }),
      agency: config.get("STRIPE_PRICE_AGENCY", { infer: true }),
    };

    this.priceToMeta = new Map(
      (Object.entries(priceMap) as [BillingPlan, string][]).map(
        ([plan, priceId]) => [priceId, PLAN_META[plan]],
      ),
    );
  }

  resolveByPriceId(priceId: string): PlanMeta | null {
    return this.priceToMeta.get(priceId) ?? null;
  }
}
