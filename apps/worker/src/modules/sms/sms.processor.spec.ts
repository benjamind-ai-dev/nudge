import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_NAMES, SmsSendJobData } from "@nudge/shared";
import { SmsProcessor } from "./sms.processor";
import { TwilioService } from "./twilio.service";
import { DeadLetterService } from "../../common/queue/dead-letter.service";

describe("SmsProcessor", () => {
  let processor: SmsProcessor;
  let twilioService: { sendSms: jest.Mock };
  let deadLetterService: { moveToDeadLetter: jest.Mock };

  beforeEach(async () => {
    twilioService = { sendSms: jest.fn().mockResolvedValue("SM_test_123") };
    deadLetterService = { moveToDeadLetter: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SmsProcessor,
        { provide: TwilioService, useValue: twilioService },
        { provide: DeadLetterService, useValue: deadLetterService },
        { provide: getQueueToken(QUEUE_NAMES.SMS_SEND), useValue: {} },
      ],
    }).compile();

    processor = module.get(SmsProcessor);
  });

  it("should call TwilioService.sendSms with job data", async () => {
    const jobData: SmsSendJobData = {
      to: "+15559876543",
      body: "Payment reminder for invoice #1234",
      businessId: "biz_001",
      invoiceId: "inv_001",
      sequenceStepId: "step_001",
    };

    const mockJob = { id: "job_1", data: jobData } as Job<SmsSendJobData>;

    await processor.process(mockJob);

    expect(twilioService.sendSms).toHaveBeenCalledWith(jobData);
  });

  it("should move to dead letter on final failure", async () => {
    const error = new Error("Twilio API error");
    const mockJob = {
      id: "job_2",
      queueName: QUEUE_NAMES.SMS_SEND,
      data: { to: "+15559876543", body: "Test", businessId: "biz_001" },
      attemptsMade: 3,
      opts: { attempts: 3 },
    } as unknown as Job<SmsSendJobData>;

    await processor.onFailed(mockJob, error);

    expect(deadLetterService.moveToDeadLetter).toHaveBeenCalledWith(
      mockJob,
      error,
    );
  });

  it("should not move to dead letter if retries remain", async () => {
    const error = new Error("Temporary failure");
    const mockJob = {
      id: "job_3",
      queueName: QUEUE_NAMES.SMS_SEND,
      data: { to: "+15559876543", body: "Test", businessId: "biz_001" },
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as unknown as Job<SmsSendJobData>;

    await processor.onFailed(mockJob, error);

    expect(deadLetterService.moveToDeadLetter).not.toHaveBeenCalled();
  });
});
