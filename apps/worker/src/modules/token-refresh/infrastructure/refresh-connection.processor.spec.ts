import { Test } from "@nestjs/testing";
import { UnrecoverableError } from "bullmq";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
} from "@nudge/connections-domain";
import { RefreshTokenUseCase } from "../application/refresh-token.use-case";
import { RefreshConnectionProcessor } from "./refresh-connection.processor";

describe("RefreshConnectionProcessor", () => {
  let useCase: { execute: jest.Mock };
  let repo: jest.Mocked<ConnectionRepository>;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    repo = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConnectionRepository>;
  });

  async function build() {
    const module = await Test.createTestingModule({
      providers: [
        RefreshConnectionProcessor,
        { provide: RefreshTokenUseCase, useValue: useCase },
        { provide: CONNECTION_REPOSITORY, useValue: repo },
      ],
    }).compile();
    return module.get(RefreshConnectionProcessor);
  }

  it("dispatches to RefreshTokenUseCase for refresh-connection jobs", async () => {
    const proc = await build();
    await proc.process({
      name: "refresh-connection",
      data: { connectionId: "c-1" },
    } as any);
    expect(useCase.execute).toHaveBeenCalledWith("c-1");
  });

  it("ignores tick jobs", async () => {
    const proc = await build();
    await proc.process({
      name: "token-refresh-tick",
      data: {},
    } as any);
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  describe("onFailed", () => {
    it("marks status=error on the 5th attempt", async () => {
      const proc = await build();
      const err = new Error("persistent outage");
      await proc.onFailed(
        { data: { connectionId: "c-1" }, attemptsMade: 5, opts: { attempts: 5 } } as any,
        err,
      );
      expect(repo.updateStatus).toHaveBeenCalledWith(
        "c-1",
        "error",
        "persistent outage",
      );
    });

    it("does nothing on earlier attempts", async () => {
      const proc = await build();
      await proc.onFailed(
        { data: { connectionId: "c-1" }, attemptsMade: 3, opts: { attempts: 5 } } as any,
        new Error("transient"),
      );
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it("does nothing when the error is UnrecoverableError (use case already handled it)", async () => {
      const proc = await build();
      await proc.onFailed(
        { data: { connectionId: "c-1" }, attemptsMade: 5, opts: { attempts: 5 } } as any,
        new UnrecoverableError("TokenRevokedError"),
      );
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it("truncates very long error messages", async () => {
      const proc = await build();
      const longMsg = "x".repeat(1000);
      await proc.onFailed(
        { data: { connectionId: "c-1" }, attemptsMade: 5, opts: { attempts: 5 } } as any,
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
