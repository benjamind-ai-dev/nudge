import { HandleEmailClickedUseCase } from "./handle-email-clicked.use-case";
import type { ResendEventsMessageRepository } from "../domain/resend-events-message.repository";

const CLICKED_AT = new Date("2024-06-01T12:05:00.000Z");

function makeRepo(clickedAt: Date | null = null): jest.Mocked<ResendEventsMessageRepository> {
  return {
    findByExternalId: jest.fn().mockResolvedValue({
      id: "msg-uuid",
      businessId: "biz-uuid",
      sequenceRunId: "run-uuid",
      status: "delivered",
      openedAt: new Date(),
      clickedAt,
    }),
    updateStatus: jest.fn(),
    updateOpenedAt: jest.fn(),
    updateClickedAt: jest.fn().mockResolvedValue(undefined),
  };
}

describe("HandleEmailClickedUseCase", () => {
  it("sets clickedAt on first click", async () => {
    const repo = makeRepo(null);
    const useCase = new HandleEmailClickedUseCase(repo);

    await useCase.execute({ externalMessageId: "re_abc", clickedAt: CLICKED_AT });

    expect(repo.updateClickedAt).toHaveBeenCalledWith("msg-uuid", "biz-uuid", CLICKED_AT);
  });

  it("skips silently when message is not found", async () => {
    const repo: jest.Mocked<ResendEventsMessageRepository> = {
      findByExternalId: jest.fn().mockResolvedValue(null),
      updateStatus: jest.fn(),
      updateOpenedAt: jest.fn(),
      updateClickedAt: jest.fn(),
    };
    const useCase = new HandleEmailClickedUseCase(repo);

    await expect(useCase.execute({ externalMessageId: "re_unknown", clickedAt: CLICKED_AT })).resolves.not.toThrow();
    expect(repo.updateClickedAt).not.toHaveBeenCalled();
  });
});
