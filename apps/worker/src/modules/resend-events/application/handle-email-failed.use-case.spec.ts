import { HandleEmailFailedUseCase } from "./handle-email-failed.use-case";
import type { ResendEventsMessageRepository } from "../domain/resend-events-message.repository";

const mockMessage = {
  id: "msg-uuid",
  businessId: "biz-uuid",
  sequenceRunId: "run-uuid",
  status: "sent" as const,
  openedAt: null,
  clickedAt: null,
};

function makeRepo(
  message: typeof mockMessage | null = mockMessage,
): jest.Mocked<ResendEventsMessageRepository> {
  return {
    findByExternalId: jest.fn().mockResolvedValue(message),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    updateOpenedAt: jest.fn(),
    updateClickedAt: jest.fn(),
  };
}

describe("HandleEmailFailedUseCase", () => {
  it("updates message status to failed", async () => {
    const repo = makeRepo();
    const useCase = new HandleEmailFailedUseCase(repo);

    await useCase.execute({ externalMessageId: "re_abc" });

    expect(repo.updateStatus).toHaveBeenCalledWith("msg-uuid", "biz-uuid", "failed");
  });

  it("skips silently when message is not found", async () => {
    const repo = makeRepo(null);
    const useCase = new HandleEmailFailedUseCase(repo);

    await expect(useCase.execute({ externalMessageId: "re_unknown" })).resolves.not.toThrow();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});
