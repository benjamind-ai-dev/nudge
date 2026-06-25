import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  PrismaTemplateRepository,
  PrismaTemplateCustomerVerifier,
} from "./prisma-template.repository";

describe("PrismaTemplateRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaTemplateRepository;
  let verifier: PrismaTemplateCustomerVerifier;

  let accountId: string;
  let businessId: string;
  let otherBusinessId: string;
  let customerId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaTemplateRepository,
        PrismaTemplateCustomerVerifier,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = moduleRef.get(PrismaTemplateRepository);
    verifier = moduleRef.get(PrismaTemplateCustomerVerifier);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const account = await prisma.account.create({
      data: {
        name: "Acct",
        email: `tpl-${randomUUID()}@example.com`,
        plan: "starter",
        status: "active",
        maxBusinesses: 2,
      },
    });
    accountId = account.id;
    const biz = await prisma.business.create({
      data: {
        accountId,
        name: "Biz",
        senderName: "Sandra",
        senderEmail: `s-${randomUUID()}@example.com`,
        timezone: "UTC",
        accountingProvider: "quickbooks",
      },
    });
    businessId = biz.id;
    const other = await prisma.business.create({
      data: {
        accountId,
        name: "Other",
        senderName: "Other",
        senderEmail: `o-${randomUUID()}@example.com`,
        timezone: "UTC",
        accountingProvider: "quickbooks",
      },
    });
    otherBusinessId = other.id;
    const cust = await prisma.customer.create({
      data: {
        businessId,
        externalId: randomUUID(),
        provider: "qbo",
        companyName: "Acme",
      },
    });
    customerId = cust.id;
  });

  afterEach(async () => {
    await prisma.customerTemplate.deleteMany({});
    await prisma.template.deleteMany({});
    await prisma.customer.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: { in: [businessId, otherBusinessId] } } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  describe("create + findById + list", () => {
    it("creates a template, then finds and lists it scoped to its business", async () => {
      const created = await repo.create({
        businessId,
        name: "First reminder",
        subject: "Hi",
        body: "Body {{company_name}}",
        signature: null,
      });
      expect(created.id).toBeDefined();
      expect(created.businessId).toBe(businessId);

      const found = await repo.findById(created.id, businessId);
      expect(found?.name).toBe("First reminder");

      const list = await repo.list(businessId);
      expect(list.map((t) => t.id)).toContain(created.id);
    });

    it("findById returns null for wrong business (tenant isolation)", async () => {
      const created = await repo.create({
        businessId,
        name: "X",
        subject: null,
        body: "B",
        signature: null,
      });
      const wrong = await repo.findById(created.id, otherBusinessId);
      expect(wrong).toBeNull();
    });

    it("list returns only templates for the given business", async () => {
      await repo.create({ businessId, name: "A", subject: null, body: "B", signature: null });
      await repo.create({ businessId: otherBusinessId, name: "Z", subject: null, body: "B", signature: null });
      const list = await repo.list(businessId);
      expect(list.every((t) => t.businessId === businessId)).toBe(true);
      expect(list.map((t) => t.name)).toEqual(expect.arrayContaining(["A"]));
      expect(list.map((t) => t.name)).not.toEqual(expect.arrayContaining(["Z"]));
    });
  });

  describe("update", () => {
    it("updates only within the business", async () => {
      const tpl = await repo.create({ businessId, name: "A", subject: null, body: "B", signature: null });
      const updated = await repo.update(tpl.id, businessId, { name: "B" });
      expect(updated?.name).toBe("B");

      const crossTenant = await repo.update(tpl.id, otherBusinessId, { name: "X" });
      expect(crossTenant).toBeNull();
      const refetched = await repo.findById(tpl.id, businessId);
      expect(refetched?.name).toBe("B");
    });
  });

  describe("delete", () => {
    it("returns true on a successful in-business delete, false otherwise", async () => {
      const tpl = await repo.create({ businessId, name: "A", subject: null, body: "B", signature: null });
      const okOther = await repo.delete(tpl.id, otherBusinessId);
      expect(okOther).toBe(false);
      const ok = await repo.delete(tpl.id, businessId);
      expect(ok).toBe(true);
      const gone = await repo.findById(tpl.id, businessId);
      expect(gone).toBeNull();
    });
  });

  describe("isInUse", () => {
    it("returns false when the template has no references", async () => {
      const tpl = await repo.create({ businessId, name: "Unused", subject: null, body: "B", signature: null });
      await expect(repo.isInUse(tpl.id, businessId)).resolves.toBe(false);
    });

    it("returns true when a customer links to the template", async () => {
      const tpl = await repo.create({ businessId, name: "CustomerLinked", subject: null, body: "B", signature: null });
      await repo.attachToCustomer(tpl.id, customerId, businessId);
      await expect(repo.isInUse(tpl.id, businessId)).resolves.toBe(true);
    });

    it("returns false for a different business even when a customer link exists", async () => {
      const tpl = await repo.create({ businessId, name: "CrossBiz", subject: null, body: "B", signature: null });
      await repo.attachToCustomer(tpl.id, customerId, businessId);
      await expect(repo.isInUse(tpl.id, otherBusinessId)).resolves.toBe(false);
    });
  });

  describe("list inUse flag", () => {
    it("marks a template as inUse when a customer links to it", async () => {
      const tpl = await repo.create({ businessId, name: "InUseViaCustomer", subject: null, body: "B", signature: null });
      const free = await repo.create({ businessId, name: "Free", subject: null, body: "B", signature: null });
      await repo.attachToCustomer(tpl.id, customerId, businessId);

      const list = await repo.list(businessId);
      const inUseTpl = list.find((t) => t.id === tpl.id);
      const freeTpl = list.find((t) => t.id === free.id);
      expect(inUseTpl?.inUse).toBe(true);
      expect(freeTpl?.inUse).toBe(false);
    });
  });

  describe("attach + detach + verifier", () => {
    it("attaches a template to a customer (idempotent on repeat)", async () => {
      const tpl = await repo.create({ businessId, name: "A", subject: null, body: "B", signature: null });
      await repo.attachToCustomer(tpl.id, customerId, businessId);
      await expect(repo.attachToCustomer(tpl.id, customerId, businessId)).resolves.toBeUndefined();
      const rows = await prisma.customerTemplate.findMany({ where: { templateId: tpl.id } });
      expect(rows).toHaveLength(1);
    });

    it("attachToCustomer is a no-op when businessId does not own the template or customer", async () => {
      const tpl = await repo.create({ businessId, name: "A", subject: null, body: "B", signature: null });
      // otherBusinessId does not own this template or customer — must not create a join row
      await repo.attachToCustomer(tpl.id, customerId, otherBusinessId);
      const rows = await prisma.customerTemplate.findMany({ where: { templateId: tpl.id } });
      expect(rows).toHaveLength(0);
    });

    it("detach removes the join row; is a no-op if missing", async () => {
      const tpl = await repo.create({ businessId, name: "A", subject: null, body: "B", signature: null });
      await repo.attachToCustomer(tpl.id, customerId, businessId);
      await repo.detachFromCustomer(tpl.id, customerId, businessId);
      const rows = await prisma.customerTemplate.findMany({ where: { templateId: tpl.id } });
      expect(rows).toHaveLength(0);
      await expect(repo.detachFromCustomer(tpl.id, customerId, businessId)).resolves.toBeUndefined();
    });

    it("detachFromCustomer is a no-op when businessId does not own the template", async () => {
      const tpl = await repo.create({ businessId, name: "A", subject: null, body: "B", signature: null });
      // Directly create the join row to test that cross-tenant detach cannot remove it
      await prisma.customerTemplate.create({ data: { templateId: tpl.id, customerId } });
      await repo.detachFromCustomer(tpl.id, customerId, otherBusinessId);
      const rows = await prisma.customerTemplate.findMany({ where: { templateId: tpl.id } });
      expect(rows).toHaveLength(1);
    });

    it("verifier confirms the customer is in the business", async () => {
      await expect(
        verifier.customerExistsInBusiness(customerId, businessId),
      ).resolves.toBe(true);
      await expect(
        verifier.customerExistsInBusiness(customerId, otherBusinessId),
      ).resolves.toBe(false);
    });
  });
});
