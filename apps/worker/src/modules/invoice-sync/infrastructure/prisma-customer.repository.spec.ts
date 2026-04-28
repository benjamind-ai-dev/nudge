import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaCustomerRepository } from "./prisma-customer.repository";

describe("PrismaCustomerRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaCustomerRepository;

  let accountId: string;
  let businessId: string;
  let tierId: string;
  let customerId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaCustomerRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = module.get(PrismaCustomerRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const account = await prisma.account.create({
      data: {
        name: "Test",
        email: `t-${randomUUID()}@example.com`,
        plan: "starter",
        status: "active",
        maxBusinesses: 1,
      },
    });
    accountId = account.id;

    const business = await prisma.business.create({
      data: {
        accountId,
        name: "Biz",
        accountingProvider: "quickbooks",
        senderName: "Sender",
        senderEmail: "s@example.com",
        timezone: "UTC",
      },
    });
    businessId = business.id;

    const tier = await prisma.relationshipTier.create({
      data: {
        businessId,
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
    });
    tierId = tier.id;

    const customer = await prisma.customer.create({
      data: {
        businessId,
        externalId: `cust-${randomUUID()}`,
        provider: "quickbooks",
        companyName: "Acme",
        relationshipTierId: tierId,
      },
    });
    customerId = customer.id;
  });

  afterEach(async () => {
    await prisma.invoice.deleteMany({ where: { businessId } });
    await prisma.customer.deleteMany({ where: { businessId } });
    await prisma.relationshipTier.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  it("zeros drifted total_outstanding when there are no contributing invoices", async () => {
    await prisma.customer.update({
      where: { id: customerId },
      data: { totalOutstanding: 999 },
    });

    await repo.reconcileAllTotalOutstanding();

    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(row.totalOutstanding).toBe(0);
  });

  it("does not update rows already matching the computed total (partial invoice)", async () => {
    await prisma.customer.update({
      where: { id: customerId },
      data: { totalOutstanding: 5000 },
    });
    await prisma.invoice.create({
      data: {
        businessId,
        customerId,
        externalId: `inv-${randomUUID()}`,
        provider: "quickbooks",
        amountCents: 10_000,
        amountPaidCents: 5000,
        balanceDueCents: 5000,
        currency: "USD",
        dueDate: new Date("2026-01-01"),
        status: "partial",
      },
    });

    await repo.reconcileAllTotalOutstanding();

    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(row.totalOutstanding).toBe(5000);
  });

  it("sets total_outstanding from open invoices and is idempotent on second reconcile", async () => {
    await prisma.invoice.create({
      data: {
        businessId,
        customerId,
        externalId: `inv-${randomUUID()}`,
        provider: "quickbooks",
        amountCents: 7500,
        amountPaidCents: 0,
        balanceDueCents: 7500,
        currency: "USD",
        dueDate: new Date("2026-01-01"),
        status: "open",
      },
    });

    await repo.reconcileAllTotalOutstanding();
    let row = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(row.totalOutstanding).toBe(7500);

    await repo.reconcileAllTotalOutstanding();
    row = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(row.totalOutstanding).toBe(7500);
  });
});
