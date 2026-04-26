import { Test } from "@nestjs/testing";
import { Job } from "bullmq";
import { DaysRecalcProcessor } from "./days-recalc.processor";
import { RecalculateDaysOverdueUseCase } from "../application/recalculate-days-overdue.use-case";

describe("DaysRecalcProcessor", () => {
  let processor: DaysRecalcProcessor;
  let recalc: jest.Mocked<RecalculateDaysOverdueUseCase>;

  beforeEach(async () => {
    recalc = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RecalculateDaysOverdueUseCase>;

    const module = await Test.createTestingModule({
      providers: [
        DaysRecalcProcessor,
        { provide: RecalculateDaysOverdueUseCase, useValue: recalc },
      ],
    }).compile();

    processor = module.get(DaysRecalcProcessor);
  });

  it("calls RecalculateDaysOverdueUseCase on days-recalc-tick job", async () => {
    recalc.execute.mockResolvedValueOnce({
      updatedCount: 100,
      transitionedCount: 5,
      transitionedWithoutSequenceCount: 2,
    });

    const job = { name: "days-recalc-tick", id: "job-1", data: {} } as Job;

    await processor.process(job);

    expect(recalc.execute).toHaveBeenCalledTimes(1);
  });

  it("ignores jobs with other names", async () => {
    const job = { name: "other-job", id: "job-2", data: {} } as Job;

    await processor.process(job);

    expect(recalc.execute).not.toHaveBeenCalled();
  });
});
