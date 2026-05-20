import { CreatePaymentLinkUseCase } from "./create-payment-link.use-case";
import type {
  InvoicePaymentLinkContext,
  InvoiceRepository,
} from "../domain/invoice.repository";
import type { StripePaymentLinkService } from "../domain/stripe-payment-link.service";
import {
  InvalidStateForPaymentLinkError,
  InvoiceNotFoundError,
} from "../domain/invoice.errors";

const mkCtx = (
  over: Partial<InvoicePaymentLinkContext> = {},
): InvoicePaymentLinkContext => ({
  id: "inv-1",
  invoiceNumber: "INV-001",
  status: "overdue",
  balanceDueCents: 10_000,
  paymentLinkUrl: null,
  customer: { companyName: "Acme Corp" },
  ...over,
});

const createMockRepo = (
  overrides: Partial<InvoiceRepository> = {},
): InvoiceRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn(),
  findForPaymentLink: jest.fn().mockResolvedValue(null),
  updatePaymentLinkUrl: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const createMockStripe = (
  overrides: Partial<StripePaymentLinkService> = {},
): StripePaymentLinkService => ({
  createPaymentLink: jest
    .fn()
    .mockResolvedValue({ paymentLinkUrl: "https://buy.stripe.com/test_abc" }),
  ...overrides,
});

describe("CreatePaymentLinkUseCase", () => {
  it("throws InvoiceNotFoundError when invoice missing", async () => {
    const useCase = new CreatePaymentLinkUseCase(
      createMockRepo(),
      createMockStripe(),
    );
    await expect(useCase.execute("missing", "biz-1")).rejects.toThrow(
      InvoiceNotFoundError,
    );
  });

  it.each(["paid", "voided"] as const)(
    "throws InvalidStateForPaymentLinkError when invoice is %s",
    async (status) => {
      const repo = createMockRepo({
        findForPaymentLink: jest.fn().mockResolvedValue(mkCtx({ status })),
      });
      const stripe = createMockStripe();
      const useCase = new CreatePaymentLinkUseCase(repo, stripe);

      await expect(useCase.execute("inv-1", "biz-1")).rejects.toThrow(
        InvalidStateForPaymentLinkError,
      );
      expect(stripe.createPaymentLink).not.toHaveBeenCalled();
      expect(repo.updatePaymentLinkUrl).not.toHaveBeenCalled();
    },
  );

  it("returns existing URL without calling Stripe when already set", async () => {
    const repo = createMockRepo({
      findForPaymentLink: jest
        .fn()
        .mockResolvedValue(
          mkCtx({ paymentLinkUrl: "https://intuit/pay/abc" }),
        ),
    });
    const stripe = createMockStripe();
    const useCase = new CreatePaymentLinkUseCase(repo, stripe);

    const result = await useCase.execute("inv-1", "biz-1");

    expect(result.paymentLinkUrl).toBe("https://intuit/pay/abc");
    expect(stripe.createPaymentLink).not.toHaveBeenCalled();
    expect(repo.updatePaymentLinkUrl).not.toHaveBeenCalled();
  });

  it("creates a Stripe link, persists it, and returns the URL", async () => {
    const ctx = mkCtx();
    const repo = createMockRepo({
      findForPaymentLink: jest.fn().mockResolvedValue(ctx),
    });
    const stripe = createMockStripe();
    const useCase = new CreatePaymentLinkUseCase(repo, stripe);

    const result = await useCase.execute("inv-1", "biz-1");

    expect(stripe.createPaymentLink).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      invoiceNumber: "INV-001",
      customerName: "Acme Corp",
      balanceDueCents: 10_000,
      currency: "USD",
    });
    expect(repo.updatePaymentLinkUrl).toHaveBeenCalledWith(
      "inv-1",
      "biz-1",
      "https://buy.stripe.com/test_abc",
    );
    expect(result.paymentLinkUrl).toBe("https://buy.stripe.com/test_abc");
  });

  it("proceeds for `disputed` status (only paid/voided are blocked)", async () => {
    const repo = createMockRepo({
      findForPaymentLink: jest
        .fn()
        .mockResolvedValue(mkCtx({ status: "disputed" })),
    });
    const stripe = createMockStripe();
    const useCase = new CreatePaymentLinkUseCase(repo, stripe);

    await expect(useCase.execute("inv-1", "biz-1")).resolves.toEqual({
      paymentLinkUrl: "https://buy.stripe.com/test_abc",
    });
  });
});
