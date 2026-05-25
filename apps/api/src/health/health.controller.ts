import { Controller, Get, Inject } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../common/database/database.module";
import { RATE_LIMIT_NAMES } from "../common/throttler/throttler-config";

@SkipThrottle({
  [RATE_LIMIT_NAMES.DEFAULT]: true,
  [RATE_LIMIT_NAMES.WEBHOOKS]: true,
  [RATE_LIMIT_NAMES.AUTH]: true,
})
@Controller("v1/health")
export class HealthController {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, "ok" | "error"> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    const isHealthy = Object.values(checks).every((v) => v === "ok");

    return {
      status: isHealthy ? "ok" : "degraded",
      version: "0.0.1",
      checks,
    };
  }
}
