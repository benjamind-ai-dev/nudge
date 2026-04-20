import { Test } from "@nestjs/testing";
import { UnrecoverableError } from "bullmq";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
} from "@nudge/connections-domain";
import { EnqueueRefreshJobsUseCase } from "../application/enqueue-refresh-jobs.use-case";
import { RefreshTokenUseCase } from "../application/refresh-token.use-case";
import { TokenRefreshProcessor } from "./token-refresh.processor";

describe("TokenRefreshProcessor", () => {
  let tickUseCase: { execute: jest.Mock };
  let refreshUseCase: { execute: jest.Mock };
  let repo: jest.Mocked<ConnectionRepository>;

  beforeEach(() => {
    tickUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
    refreshUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
    repo = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConnectionRepository>;
  });

  async function build() {
    const module = await Test.createTestingModule({
      providers: [
        TokenRefreshProcessor,
        { provide: EnqueueRefreshJobsUseCase, useValue: tickUseCase },
        { provide: RefreshTokenUseCase, useValue: refreshUseCase },
        { provide: CONNECTION_REPOSITORY, useValue: repo },
      ],
    }).compile();
    return module.get(TokenRefreshProcessor);
  }

  describe("process", () => {
    it("dispatches tick jobs to EnqueueRefreshJobsUseCase", async () => {
      const proc = await build();
      await proc.process({ name: "token-refresh-tick", data: undefined } as any);
      expect(tickUseCase.execute).toHaveBeenCalledTimes(1);
      expect(refreshUseCase.execute).not.toHaveBeenCalled();
    });

    it("dispatches refresh-connection jobs to RefreshTokenUseCase", async () => {
      const proc = await build();
      await proc.process({
        name: "refresh-connection",
        data: { connectionId: "c-1" },
      } as any);
      expect(refreshUseCase.execute).toHaveBeenCalledWith("c-1");
      expect(tickUseCase.execute).not.toHaveBeenCalled();
    });

    it("ignores unknown job names with a warning", async () => {
      const proc = await build();
      await proc.process({ name: "something-else", data: {} } as any);
      expect(tickUseCase.execute).not.toHaveBeenCalled();
      expect(refreshUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe("onFailed", () => {
    it("marks status=error on the 5th attempt for refresh-connection", async () => {
      const proc = await build();
      await proc.onFailed(
        {
          data: { connectionId: "c-1" },
          attemptsMade: 5,
          opts: { attempts: 5 },
        } as any,
        new Error("persistent outage"),
      );
      expect(repo.updateStatus).toHaveBeenCalledWith("c-1", "error", "persistent outage");
    });

    it("does nothing on earlier attempts", async () => {
      const proc = await build();
      await proc.onFailed(
        {
          data: { connectionId: "c-1" },
          attemptsMade: 3,
          opts: { attempts: 5 },
        } as any,
        new Error("transient"),
      );
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it("does nothing when the error is UnrecoverableError", async () => {
      const proc = await build();
      await proc.onFailed(
        {
          data: { connectionId: "c-1" },
          attemptsMade: 5,
          opts: { attempts: 5 },
        } as any,
        new UnrecoverableError("TokenRevokedError"),
      );
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it("does nothing for failed tick jobs (no connectionId)", async () => {
      const proc = await build();
      await proc.onFailed(
        {
          data: undefined,
          attemptsMade: 5,
          opts: { attempts: 5 },
        } as any,
        new Error("tick failed"),
      );
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it("truncates very long error messages", async () => {
      const proc = await build();
      const longMsg = "x".repeat(1000);
      await proc.onFailed(
        {
          data: { connectionId: "c-1" },
          attemptsMade: 5,
          opts: { attempts: 5 },
        } as any,
        new Error(longMsg),
      );
      expect(repo.updateStatus).toHaveBeenCalledWith(
        "c-1",
        "error",
        expect.stringMatching(/^x{500}$/),
      );
    });
  });
});
