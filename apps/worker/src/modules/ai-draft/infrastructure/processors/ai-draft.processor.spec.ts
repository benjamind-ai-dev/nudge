import { AiDraftProcessor } from "./ai-draft.processor";
import type { GenerateAiDraftUseCase, GenerateAiDraftResult } from "../../application/generate-ai-draft.use-case";
import type { DeadLetterService } from "../../../../common/queue/dead-letter.service";

function makeJob(data: { messageId: string; businessId: string }, opts: Partial<{ attempts: number; attemptsMade: number; id: string; name: string }> = {}) {
  return {
    id: opts.id ?? "job-1",
    name: opts.name ?? "generate-ai-draft",
    data,
    opts: { attempts: opts.attempts ?? 2 },
    attemptsMade: opts.attemptsMade ?? 0,
  } as never;
}

describe("AiDraftProcessor", () => {
  it("delegates to the use case and logs duration", async () => {
    const useCase = {
      execute: jest.fn<Promise<GenerateAiDraftResult>, never>().mockResolvedValue({
        generated: true,
        durationMs: 1234,
      }),
    } as unknown as GenerateAiDraftUseCase;
    const dlq = { moveToDeadLetter: jest.fn() } as unknown as DeadLetterService;
    const proc = new AiDraftProcessor(useCase, dlq);

    await proc.process(makeJob({ messageId: "m-1", businessId: "biz-1" }));

    expect(useCase.execute).toHaveBeenCalledWith({ messageId: "m-1", businessId: "biz-1" });
  });

  it("dead-letters on final failed attempt", async () => {
    const useCase = { execute: jest.fn() } as unknown as GenerateAiDraftUseCase;
    const dlq = { moveToDeadLetter: jest.fn().mockResolvedValue(undefined) } as unknown as DeadLetterService;
    const proc = new AiDraftProcessor(useCase, dlq);

    const job = makeJob({ messageId: "m-1", businessId: "biz-1" }, { attempts: 2, attemptsMade: 2 });
    await proc.onFailed(job, new Error("boom"));

    expect(dlq.moveToDeadLetter).toHaveBeenCalledWith(job, expect.any(Error));
  });

  it("does NOT dead-letter while retries remain", async () => {
    const useCase = { execute: jest.fn() } as unknown as GenerateAiDraftUseCase;
    const dlq = { moveToDeadLetter: jest.fn() } as unknown as DeadLetterService;
    const proc = new AiDraftProcessor(useCase, dlq);

    const job = makeJob({ messageId: "m-1", businessId: "biz-1" }, { attempts: 2, attemptsMade: 1 });
    await proc.onFailed(job, new Error("transient"));

    expect(dlq.moveToDeadLetter).not.toHaveBeenCalled();
  });
});
