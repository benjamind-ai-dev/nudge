import { HandleEmailOpenedUseCase } from "./handle-email-opened.use-case";
import type { ResendEventsMessageRepository } from "../domain/resend-events-message.repository";

const OPENED_AT = new Date("2024-06-01T12:00:00.000Z");

function makeRepo(openedAt: Date | null = null): jest.Mocked<ResendEventsMessageRepository> {
  return {
    findByExternalId: jest.fn().mockResolvedValue({
      id: "msg-uuid",
      businessId: "biz-uuid",
      sequenceRunId: "run-uuid",
      status: "delivered",
      openedAt,
      clickedAt: null,
    }),
    updateStatus: jest.fn(),
    updateOpenedAt: jest.fn().mockResolvedValue(undefined),
    updateClickedAt: jest.fn(),
  };
}

describe("HandleEmailOpenedUseCase", () => {
  it("sets openedAt on first open", async () => {
    const repo = makeRepo(null);
    const useCase = new HandleEmailOpenedUseCase(repo);

    await useCase.execute({ externalMessageId: "re_abc", openedAt: OPENED_AT });

    expect(repo.updateOpenedAt).toHaveBeenCalledWith("msg-uuid", "biz-uuid", OPENED_AT);
  });

  it("skips silently when message is not found", async () => {
    const repo: jest.Mocked<ResendEventsMessageRepository> = {
      findByExternalId: jest.fn().mockResolvedValue(null),
      updateStatus: jest.fn(),
      updateOpenedAt: jest.fn(),
      updateClickedAt: jest.fn(),
    };
    const useCase = new HandleEmailOpenedUseCase(repo);

    await expect(useCase.execute({ externalMessageId: "re_unknown", openedAt: OPENED_AT })).resolves.not.toThrow();
    expect(repo.updateOpenedAt).not.toHaveBeenCalled();
  });
});
