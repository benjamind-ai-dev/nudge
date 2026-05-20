import { Inject, Injectable, Logger } from "@nestjs/common";
import { ResolveOrgIdForAccountUseCase } from "../../clerk-webhook/application/resolve-org-id-for-account.use-case";
import {
  DEV_ACCOUNT_LISTING_REPOSITORY,
  type DevAccountListingRepository,
} from "../domain/dev-account-listing.repository";

export interface BackfillClerkOrgsResult {
  scanned: number;
  succeeded: number;
  skipped: number;
  failed: number;
  failures: { accountId: string; error: string }[];
}

@Injectable()
export class BackfillClerkOrgsUseCase {
  private readonly logger = new Logger(BackfillClerkOrgsUseCase.name);

  constructor(
    @Inject(DEV_ACCOUNT_LISTING_REPOSITORY)
    private readonly accounts: DevAccountListingRepository,
    private readonly resolveOrg: ResolveOrgIdForAccountUseCase,
  ) {}

  async execute(): Promise<BackfillClerkOrgsResult> {
    const accountIds = await this.accounts.listAccountsMissingClerkOrg();
    let succeeded = 0;
    let skipped = 0;
    let failed = 0;
    const failures: { accountId: string; error: string }[] = [];

    // Serial to respect Clerk rate limits and to surface the exact failing
    // account if anything throws. At MVP scale this completes in seconds.
    for (const accountId of accountIds) {
      try {
        await this.resolveOrg.execute(accountId);
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // The "owner clerk user id is not set" error means the account
        // exists but has no Clerk-linked owner — nothing we can do here.
        if (/owner clerk user id is not set/i.test(message)) {
          skipped += 1;
        } else {
          failed += 1;
          failures.push({ accountId, error: message });
          this.logger.warn({
            msg: "Backfill failed for account",
            event: "clerk_org_backfill_failed",
            accountId,
            error: message,
          });
        }
      }
    }

    const result: BackfillClerkOrgsResult = {
      scanned: accountIds.length,
      succeeded,
      skipped,
      failed,
      failures,
    };
    this.logger.log({
      msg: "Clerk Org backfill complete",
      event: "clerk_org_backfill_complete",
      ...result,
      failures: undefined,
    });
    return result;
  }
}
