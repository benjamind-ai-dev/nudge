import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { JOB_NAMES } from "@nudge/shared";
import { DaysRecalcProcessor } from "./days-recalc.processor";
import { RecalculateDaysOverdueUseCase } from "../application/recalculate-days-overdue.use-case";
import { ReconcileTotalOutstandingUseCase } from "../../invoice-sync/application/reconcile-total-outstanding.use-case";

describe("DaysRecalcProcessor", () => {
  let processor: DaysRecalcProcessor;
  let recalc: jest.Mocked<RecalculateDaysOverdueUseCase>;
  let reconcile: jest.Mocked<Pick<ReconcileTotalOutstandingUseCase, "execute">>;

  beforeEach(async () => {
    recalc = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RecalculateDaysOverdueUseCase>;

    reconcile = {
      execute: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DaysRecalcProcessor,
        { provide: RecalculateDaysOverdueUseCase, useValue: recalc },
        { provide: ReconcileTotalOutstandingUseCase, useValue: reconcile },
      ],
    }).compile();

    processor = module.get(DaysRecalcProcessor);
  });

  it("calls recalculate then reconcile on days-recalc-tick job", async () => {
    const order: string[] = [];
    recalc.execute.mockImplementation(async () => {
      order.push("recalc");
      return {
        updatedCount: 100,
        transitionedCount: 5,
        transitionedWithoutSequenceCount: 2,
      };
    });
    reconcile.execute.mockImplementation(async () => {
      order.push("reconcile");
      return { updatedCount: 3 };
    });

    const job = { name: JOB_NAMES.DAYS_RECALC_TICK, id: "job-1", data: {} } as Job;

    await processor.process(job);

    expect(order).toEqual(["recalc", "reconcile"]);
    expect(recalc.execute).toHaveBeenCalledTimes(1);
    expect(reconcile.execute).toHaveBeenCalledTimes(1);
  });

  it("ignores jobs with other names and does not call recalculate or reconcile", async () => {
    const job = { name: "other-job", id: "job-2", data: {} } as Job;

    await processor.process(job);

    expect(recalc.execute).not.toHaveBeenCalled();
    expect(reconcile.execute).not.toHaveBeenCalled();
  });

  it("logs reconcile_step_failed and completes when reconcile throws", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    recalc.execute.mockResolvedValue({
      updatedCount: 1,
      transitionedCount: 0,
      transitionedWithoutSequenceCount: 0,
    });
    reconcile.execute.mockRejectedValue(new Error("reconcile failed"));

    const job = { name: JOB_NAMES.DAYS_RECALC_TICK, id: "job-3", data: {} } as Job;

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "reconcile_step_failed",
        error: "reconcile failed",
        jobId: "job-3",
      }),
    );

    errorSpy.mockRestore();
  });
});
