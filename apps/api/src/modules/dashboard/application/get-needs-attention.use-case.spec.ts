import { GetNeedsAttentionUseCase } from "./get-needs-attention.use-case";
import type { NeedsAttentionItem } from "../domain/needs-attention-item.entity";

const BIZ_ID = "11111111-1111-1111-1111-111111111111";

function item(overrides: Partial<NeedsAttentionItem> = {}): NeedsAttentionItem {
  return {
    id: "msg-1",
    type: "client_replied",
    invoiceId: "inv-1",
    invoiceNumber: "INV-001",
    customerId: "cust-1",
    customerName: "Acme",
    amountCents: 50_000,
    balanceDueCents: 25_000,
    daysOverdue: 14,
    occurredAt: "2026-05-20T10:00:00.000Z",
    summary: "Replied to step 2",
    ...overrides,
  };
}

describe("GetNeedsAttentionUseCase", () => {
  it("returns items from the repository", async () => {
    const items = [item(), item({ id: "i2", invoiceId: "inv-2" })];
    const repo = { listItems: jest.fn().mockResolvedValue(items) };
    const useCase = new GetNeedsAttentionUseCase(repo as never);

    const result = await useCase.execute(BIZ_ID, 10);

    expect(result).toEqual(items);
    expect(repo.listItems).toHaveBeenCalledWith(BIZ_ID, 10);
  });

  it("returns an empty array when nothing needs attention", async () => {
    const repo = { listItems: jest.fn().mockResolvedValue([]) };
    const useCase = new GetNeedsAttentionUseCase(repo as never);

    const result = await useCase.execute(BIZ_ID, 10);

    expect(result).toEqual([]);
  });
});
