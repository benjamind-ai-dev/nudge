import { PLAN_LIMITS, DEFAULT_PLAN_LIMITS } from "@nudge/shared";
import { EntitlementsService } from "./entitlements.service";

type PrismaStub = {
  account: { findUnique: jest.Mock };
  business: { findUnique: jest.Mock };
  user: { count: jest.Mock };
};

const makePrisma = (over: Partial<PrismaStub> = {}): PrismaStub => ({
  account: { findUnique: jest.fn() },
  business: { findUnique: jest.fn() },
  user: { count: jest.fn() },
  ...over,
});

describe("EntitlementsService", () => {
  it("resolves limits from the account's plan", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue({ plan: "agency" });
    const svc = new EntitlementsService(prisma as never);

    await expect(svc.limitsForAccount("acc_1")).resolves.toEqual(PLAN_LIMITS.agency);
  });

  it("falls back to the default floor when plan is null", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue({ plan: null });
    const svc = new EntitlementsService(prisma as never);

    await expect(svc.limitsForAccount("acc_1")).resolves.toEqual(DEFAULT_PLAN_LIMITS);
  });

  it("falls back to the floor when the account is missing", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue(null);
    const svc = new EntitlementsService(prisma as never);

    await expect(svc.limitsForAccount("nope")).resolves.toEqual(DEFAULT_PLAN_LIMITS);
  });

  it("resolves limits from the business's account plan", async () => {
    const prisma = makePrisma();
    prisma.business.findUnique.mockResolvedValue({ account: { plan: "growth" } });
    const svc = new EntitlementsService(prisma as never);

    await expect(svc.limitsForBusiness("biz_1")).resolves.toEqual(PLAN_LIMITS.growth);
  });

  it("counts seats for the account", async () => {
    const prisma = makePrisma();
    prisma.user.count.mockResolvedValue(3);
    const svc = new EntitlementsService(prisma as never);

    await expect(svc.seatUsage("acc_1")).resolves.toBe(3);
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { accountId: "acc_1" } });
  });
});
