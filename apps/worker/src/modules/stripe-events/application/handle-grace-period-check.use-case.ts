import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from "../domain/account-billing.repository";

@Injectable()
export class HandleGracePeriodCheckUseCase {
  private readonly logger = new Logger(HandleGracePeriodCheckUseCase.name);

  constructor(
    @Inject(ACCOUNT_BILLING_REPOSITORY)
    private readonly accounts: AccountBillingRepository,
  ) {}

  async execute(payload: unknown): Promise<void> {
    const data = payload as { accountId: string };
    const { accountId } = data;

    const account = await this.accounts.findById(accountId);
    if (!account) {
      this.logger.warn({
        msg: "Grace period check: account not found",
        event: "stripe_grace_period_account_not_found",
        accountId,
      });
      return;
    }

    if (account.status !== "past_due") {
      this.logger.log({
        msg: "Grace period check: account no longer past_due, skipping sequence stop",
        event: "stripe_grace_period_resolved",
        accountId,
        currentStatus: account.status,
      });
      return;
    }

    const stoppedCount =
      await this.accounts.stopAllActiveSequenceRuns(accountId);

    this.logger.log({
      msg: "Grace period expired — active sequences stopped",
      event: "stripe_grace_period_sequences_stopped",
      accountId,
      stoppedSequenceRuns: stoppedCount,
    });
  }
}
