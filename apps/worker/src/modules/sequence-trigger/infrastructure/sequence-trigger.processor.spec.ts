import { Test } from "@nestjs/testing";
import { Job } from "bullmq";
import { SequenceTriggerProcessor } from "./sequence-trigger.processor";
import { TriggerSequencesUseCase } from "../application/trigger-sequences.use-case";

describe("SequenceTriggerProcessor", () => {
  let processor: SequenceTriggerProcessor;
  let triggerSequences: jest.Mocked<TriggerSequencesUseCase>;

  beforeEach(async () => {
    triggerSequences = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<TriggerSequencesUseCase>;

    const module = await Test.createTestingModule({
      providers: [
        SequenceTriggerProcessor,
        { provide: TriggerSequencesUseCase, useValue: triggerSequences },
      ],
    }).compile();

    processor = module.get(SequenceTriggerProcessor);
  });

  it("calls TriggerSequencesUseCase on sequence-trigger-tick job", async () => {
    triggerSequences.execute.mockResolvedValueOnce({
      invoicesProcessed: 5,
      runsCreated: 3,
      skipped: [],
    });

    const job = { name: "sequence-trigger-tick", id: "job-1", data: {} } as Job;

    await processor.process(job);

    expect(triggerSequences.execute).toHaveBeenCalledTimes(1);
  });

  it("ignores jobs with other names", async () => {
    const job = { name: "other-job", id: "job-2", data: {} } as Job;

    await processor.process(job);

    expect(triggerSequences.execute).not.toHaveBeenCalled();
  });
});
