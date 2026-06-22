import { GetRecentWinsUseCase } from "./get-recent-wins.use-case";
import type { RecentWinItem } from "../domain/recent-win-item.entity";

const BIZ_ID = "11111111-1111-1111-1111-111111111111";

function win(overrides: Partial<RecentWinItem> = {}): RecentWinItem {
  return {
    id: "inv-1",
    invoiceId: "inv-1",
    invoiceNumber: "INV-001",
    customerId: "cust-1",
    customerName: "Acme Corp",
    amountCents: 420_000,
    paidAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("GetRecentWinsUseCase", () => {
  it("returns items from the repository", async () => {
    const items = [win(), win({ id: "inv-2", invoiceId: "inv-2" })];
    const repo = { listItems: jest.fn().mockResolvedValue(items) };
    const useCase = new GetRecentWinsUseCase(repo as never);

    const result = await useCase.execute(BIZ_ID, 5);

    expect(result).toEqual(items);
    expect(repo.listItems).toHaveBeenCalledWith(BIZ_ID, 5);
  });

  it("returns an empty array when there are no recent wins", async () => {
    const repo = { listItems: jest.fn().mockResolvedValue([]) };
    const useCase = new GetRecentWinsUseCase(repo as never);

    const result = await useCase.execute(BIZ_ID, 5);

    expect(result).toEqual([]);
  });
});
