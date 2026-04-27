import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  QUEUE_NAMES,
  type XeroWebhooksJobData,
} from "@nudge/shared";
import {
  xeroWebhookPayloadSchema,
  type XeroEvent,
} from "../domain/xero-webhook-payload";
import {
  XERO_CONNECTION_LOOKUP,
  type XeroConnectionLookup,
} from "../domain/xero-connection-lookup.repository";

const SINGLE_INVOICE_JOB_NAME = "sync-single-invoice";
const SUPPORTED_EVENT_TYPES = new Set(["CREATE", "UPDATE"]);

export interface ProcessXeroWebhookInput {
  rawBody: Buffer;
}

@Injectable()
export class ProcessXeroWebhookUseCase {
  private readonly logger = new Logger(ProcessXeroWebhookUseCase.name);

  constructor(
    @Inject(XERO_CONNECTION_LOOKUP)
    private readonly lookup: XeroConnectionLookup,
    @InjectQueue(QUEUE_NAMES.XERO_WEBHOOKS)
    private readonly queue: Queue<XeroWebhooksJobData>,
  ) {}

  async execute(input: ProcessXeroWebhookInput): Promise<void> {
    const bodyPreview = input.rawBody.toString("utf8").slice(0, 500);

    let json: unknown;
    try {
      json = JSON.parse(input.rawBody.toString("utf8"));
    } catch {
      this.logger.warn({
        msg: "Xero webhook body was not valid JSON",
        event: "xero_webhook_malformed",
        bodyPreview,
      });
      return;
    }

    const parsed = xeroWebhookPayloadSchema.safeParse(json);
    if (!parsed.success) {
      this.logger.warn({
        msg: "Xero webhook body did not match payload schema",
        event: "xero_webhook_malformed",
        issues: parsed.error.issues.slice(0, 5),
        bodyPreview,
      });
      return;
    }

    for (const event of parsed.data.events) {
      await this.handleEvent(event);
    }
  }

  private async handleEvent(event: XeroEvent): Promise<void> {
    if (event.eventCategory !== "INVOICE") {
      this.logger.log({
        msg: "Xero webhook event ignored (non-INVOICE category)",
        event: "xero_webhook_event_ignored",
        eventCategory: event.eventCategory,
        eventType: event.eventType,
        resourceId: event.resourceId,
      });
      return;
    }

    if (!SUPPORTED_EVENT_TYPES.has(event.eventType)) {
      this.logger.log({
        msg: "Xero webhook event ignored (unsupported eventType)",
        event: "xero_webhook_event_ignored",
        eventCategory: event.eventCategory,
        eventType: event.eventType,
        resourceId: event.resourceId,
      });
      return;
    }

    const conn = await this.lookup.findByTenantId(event.tenantId);
    if (!conn) {
      this.logger.log({
        msg: "Xero webhook event has no matching connection",
        event: "xero_webhook_no_connection",
        tenantId: event.tenantId,
        resourceId: event.resourceId,
      });
      return;
    }
    if (conn.status !== "connected") {
      this.logger.log({
        msg: "Xero webhook event skipped: connection not connected",
        event: "xero_webhook_connection_not_connected",
        tenantId: event.tenantId,
        resourceId: event.resourceId,
        connectionId: conn.connectionId,
        status: conn.status,
      });
      return;
    }

    const occurredAt = event.eventDateUtc ?? new Date().toISOString();
    const data: XeroWebhooksJobData = {
      connectionId: conn.connectionId,
      tenantId: event.tenantId,
      externalInvoiceId: event.resourceId,
      eventCategory: event.eventCategory,
      eventType: event.eventType,
      occurredAt,
    };

    const jobId = `xero-wh-${event.tenantId}-${event.resourceId}-${event.eventType}-${event.eventDateUtc ?? Date.now()}`;

    try {
      await this.queue.add(SINGLE_INVOICE_JOB_NAME, data, {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      this.logger.log({
        msg: "Xero webhook event enqueued",
        event: "xero_webhook_enqueued",
        tenantId: event.tenantId,
        resourceId: event.resourceId,
        connectionId: conn.connectionId,
        businessId: conn.businessId,
        eventCategory: event.eventCategory,
        eventType: event.eventType,
      });
    } catch (err) {
      this.logger.error({
        msg: "Failed to enqueue Xero webhook job",
        event: "xero_webhook_enqueue_failed",
        tenantId: event.tenantId,
        resourceId: event.resourceId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
