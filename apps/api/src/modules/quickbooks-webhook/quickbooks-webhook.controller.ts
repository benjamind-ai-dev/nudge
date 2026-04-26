import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { Request } from "express";
import {
  QUEUE_NAMES,
  type QuickbooksWebhooksJobData,
} from "@nudge/shared";
import {
  cloudEventsArraySchema,
  parseInvoiceOperation,
  type CloudEvent,
} from "./domain/cloudevents-payload";
import {
  CONNECTION_LOOKUP_BY_REALM,
  type ConnectionLookupByRealm,
} from "./domain/connection-lookup-by-realm.repository";
import {
  INTUIT_SIGNATURE_VERIFIER,
  type IntuitSignatureVerifier,
} from "./infrastructure/intuit-signature.verifier";

const SINGLE_INVOICE_JOB_NAME = "sync-single-invoice";

@Controller("v1/webhooks/quickbooks")
export class QuickbooksWebhookController {
  private readonly logger = new Logger(QuickbooksWebhookController.name);

  constructor(
    @Inject(INTUIT_SIGNATURE_VERIFIER)
    private readonly verifier: IntuitSignatureVerifier,
    @Inject(CONNECTION_LOOKUP_BY_REALM)
    private readonly lookup: ConnectionLookupByRealm,
    @InjectQueue(QUEUE_NAMES.QUICKBOOKS_WEBHOOKS)
    private readonly queue: Queue<QuickbooksWebhooksJobData>,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("intuit-signature") signature: string | undefined,
  ): Promise<void> {
    const rawBody = req.rawBody;
    if (!signature || !rawBody?.length) {
      this.logger.warn({
        msg: "QB webhook rejected",
        event: "qb_webhook_unauthorized",
        reason: !signature ? "missing_signature" : "missing_body",
      });
      throw new ForbiddenException();
    }

    if (!this.verifier.verify(rawBody, signature)) {
      this.logger.warn({
        msg: "QB webhook rejected",
        event: "qb_webhook_unauthorized",
        reason: "signature_mismatch",
      });
      throw new ForbiddenException();
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString("utf8"));
    } catch {
      this.logger.warn({
        msg: "QB webhook body was not valid JSON",
        event: "qb_webhook_malformed",
      });
      return;
    }

    const parsed = cloudEventsArraySchema.safeParse(json);
    if (!parsed.success) {
      this.logger.warn({
        msg: "QB webhook body did not match CloudEvents schema",
        event: "qb_webhook_malformed",
        issues: parsed.error.issues.slice(0, 5),
      });
      return;
    }

    for (const event of parsed.data) {
      await this.handleEvent(event);
    }
  }

  private async handleEvent(event: CloudEvent): Promise<void> {
    const operation = parseInvoiceOperation(event.type);
    if (!operation) {
      this.logger.log({
        msg: "QB webhook event ignored (non-invoice type)",
        event: "qb_webhook_event_ignored",
        eventId: event.id,
        type: event.type,
      });
      return;
    }

    const conn = await this.lookup.findByRealm(
      "quickbooks",
      event.intuitaccountid,
    );
    if (!conn) {
      this.logger.log({
        msg: "QB webhook event has no matching connection",
        event: "qb_webhook_no_connection",
        eventId: event.id,
        realmId: event.intuitaccountid,
      });
      return;
    }
    if (conn.status !== "connected") {
      this.logger.log({
        msg: "QB webhook event skipped: connection not connected",
        event: "qb_webhook_connection_not_connected",
        eventId: event.id,
        realmId: event.intuitaccountid,
        connectionId: conn.connectionId,
        status: conn.status,
      });
      return;
    }

    const data: QuickbooksWebhooksJobData = {
      connectionId: conn.connectionId,
      realmId: event.intuitaccountid,
      externalInvoiceId: event.intuitentityid,
      eventId: event.id,
      operation,
      occurredAt: event.time,
    };

    try {
      await this.queue.add(SINGLE_INVOICE_JOB_NAME, data, {
        jobId: `qb-wh-${event.id}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      this.logger.log({
        msg: "QB webhook event enqueued",
        event: "qb_webhook_enqueued",
        eventId: event.id,
        realmId: event.intuitaccountid,
        externalInvoiceId: event.intuitentityid,
        connectionId: conn.connectionId,
        businessId: conn.businessId,
        operation,
      });
    } catch (err) {
      this.logger.error({
        msg: "Failed to enqueue QB webhook job",
        event: "qb_webhook_enqueue_failed",
        eventId: event.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
