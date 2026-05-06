import { HandleEmailReceivedUseCase } from "./handle-email-received.use-case";
import type {
  ActiveRunForCustomer,
  ResendEventsCustomerRepository,
} from "../domain/resend-events-customer.repository";
import type { ResendEventsSequenceRunRepository } from "../domain/resend-events-sequence-run.repository";
import type { ResendEventsBusinessRepository } from "../domain/resend-events-business.repository";
import type { EmailService } from "../../message-send/domain/email.service";

const baseRun: ActiveRunForCustomer = {
  runId: "run-uuid",
  businessId: "biz-uuid",
  companyName: "Acme Corp",
  invoiceNumber: "INV-1001",
  balanceDueCents: 125000,
  currency: "USD",
  paymentLinkUrl: "https://pay.example.com/abc123",
};

const mockBusiness = { name: "Sandra's Bakery", ownerEmail: "sandra@example.com" };

function makeCustomerRepo(runs: ActiveRunForCustomer[] = [baseRun]): jest.Mocked<ResendEventsCustomerRepository> {
  return {
    findActiveRunsByContactEmail: jest.fn().mockResolvedValue(runs),
  };
}

function makeRunRepo(): jest.Mocked<ResendEventsSequenceRunRepository> {
  return {
    stopRun: jest.fn().mockResolvedValue(undefined),
    pauseRun: jest.fn(),
  };
}

function makeBusinessRepo(): jest.Mocked<ResendEventsBusinessRepository> {
  return { findWithOwner: jest.fn().mockResolvedValue(mockBusiness) };
}

function makeEmailService(): jest.Mocked<EmailService> {
  return { send: jest.fn().mockResolvedValue({ externalMessageId: "re_alert" }) };
}

describe("HandleEmailReceivedUseCase", () => {
  it("stops the run, sends alert with mailto CTA and balance when payment link is present", async () => {
    const customerRepo = makeCustomerRepo();
    const runRepo = makeRunRepo();
    const businessRepo = makeBusinessRepo();
    const emailService = makeEmailService();

    const useCase = new HandleEmailReceivedUseCase(customerRepo, runRepo, businessRepo, emailService);
    await useCase.execute({ fromEmail: "billing@acme.com" });

    expect(runRepo.stopRun).toHaveBeenCalledWith("run-uuid", "biz-uuid", "client_replied");
    expect(emailService.send).toHaveBeenCalledTimes(1);

    const sent = emailService.send.mock.calls[0][0];
    expect(sent.to).toBe("sandra@example.com");
    expect(sent.subject).toContain("Acme Corp");
    expect(sent.html).toContain("Invoice INV-1001");
    expect(sent.html).toContain("$1,250.00");
    expect(sent.html).toMatch(/href="mailto:billing@acme\.com\?[^"]*pay\.example\.com%2Fabc123/);
    expect(sent.html).toContain("Send Payment Link");
  });
});
