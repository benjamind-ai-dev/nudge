import { Test } from "@nestjs/testing";
import { Job } from "bullmq";
import { EnqueueRefreshJobsUseCase } from "../application/enqueue-refresh-jobs.use-case";
import { TokenRefreshTickProcessor } from "./token-refresh-tick.processor";

describe("TokenRefreshTickProcessor", () => {
  it("dispatches to EnqueueRefreshJobsUseCase only for tick jobs", async () => {
    const useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        TokenRefreshTickProcessor,
        { provide: EnqueueRefreshJobsUseCase, useValue: useCase },
      ],
    }).compile();
    const proc = module.get(TokenRefreshTickProcessor);

    await proc.process({ name: "token-refresh-tick" } as Job);
    expect(useCase.execute).toHaveBeenCalledTimes(1);

    await proc.process({ name: "refresh-connection" } as Job);
    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });
});
