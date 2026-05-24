import { BullmqAiDraftProducer } from "./bullmq-ai-draft.producer";

describe("BullmqAiDraftProducer", () => {
  it("adds a generate-ai-draft job to the ai-draft queue with attempts=2", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-1" });
    const queue = { add } as never;
    const producer = new BullmqAiDraftProducer(queue);

    await producer.enqueue("msg-1", "biz-1");

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      "generate-ai-draft",
      { messageId: "msg-1", businessId: "biz-1" },
      expect.objectContaining({
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: false,
      }),
    );
  });
});
