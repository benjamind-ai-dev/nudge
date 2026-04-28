import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { ReconcileTotalOutstandingUseCase } from "./reconcile-total-outstanding.use-case";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../domain/repositories";

describe("ReconcileTotalOutstandingUseCase", () => {
  let useCase: ReconcileTotalOutstandingUseCase;
  let customers: jest.Mocked<Pick<CustomerRepository, "reconcileAllTotalOutstanding">>;

  beforeEach(async () => {
    customers = {
      reconcileAllTotalOutstanding: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReconcileTotalOutstandingUseCase,
        { provide: CUSTOMER_REPOSITORY, useValue: customers },
      ],
    }).compile();

    useCase = module.get(ReconcileTotalOutstandingUseCase);
  });

  it("calls reconcileAllTotalOutstanding exactly once", async () => {
    customers.reconcileAllTotalOutstanding.mockResolvedValue({ updatedCount: 3 });

    await useCase.execute();

    expect(customers.reconcileAllTotalOutstanding).toHaveBeenCalledTimes(1);
  });

  it("returns the repository updatedCount", async () => {
    customers.reconcileAllTotalOutstanding.mockResolvedValue({ updatedCount: 42 });

    const result = await useCase.execute();

    expect(result).toEqual({ updatedCount: 42 });
  });

  it("logs completion with event reconcile_total_outstanding_completed and updatedCount", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    customers.reconcileAllTotalOutstanding.mockResolvedValue({ updatedCount: 7 });

    await useCase.execute();

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "reconcile_total_outstanding_completed",
        updatedCount: 7,
      }),
    );

    logSpy.mockRestore();
  });
});
