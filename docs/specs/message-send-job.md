# Message Send Job — Specification

## Overview

The message-send job is responsible for actually sending follow-up emails and SMS messages to customers with overdue invoices. It processes `SequenceRun` records that are ready to send, renders templates with live data, sends via Resend (email) or Twilio (SMS), logs the message, and advances to the next step.

## Trigger

- **Queue:** `message-send`
- **Schedule:** Every 1 minute via BullMQ repeatable job
- **Job Types:**
  - `message-send-tick` — Scheduler tick that queries and enqueues individual send jobs
  - `send-message` — Individual message send job for one sequence run

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  message-send   │     │  send-message   │     │    Resend /     │
│      tick       │────▶│      job        │────▶│     Twilio      │
│  (every 1 min)  │     │  (concurrency   │     │                 │
│                 │     │      10)        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Query runs            Render template          Send message
   ready to send         Check status             Get external ID
   Enqueue jobs          Send via channel         
                         Create message record
                         Advance step
```

## Query: Runs Ready to Send

```sql
SELECT sr.*, ss.*, i.*, c.*, b.*
FROM sequence_runs sr
JOIN sequence_steps ss ON sr.current_step_id = ss.id
JOIN invoices i ON sr.invoice_id = i.id
JOIN customers c ON i.customer_id = c.id
JOIN businesses b ON i.business_id = b.id
WHERE sr.status = 'active'
  AND sr.next_send_at <= NOW()
```

## Template Variables

| Variable | Source | Format |
|----------|--------|--------|
| `{{customer.company_name}}` | `customer.companyName` | String |
| `{{customer.contact_name}}` | `customer.contactName` | String |
| `{{invoice.invoice_number}}` | `invoice.invoiceNumber` | String |
| `{{invoice.amount}}` | `invoice.amountCents` | `$X,XXX.XX` |
| `{{invoice.balance_due}}` | `invoice.balanceDueCents` | `$X,XXX.XX` |
| `{{invoice.due_date}}` | `invoice.dueDate` | `MMM D, YYYY` |
| `{{invoice.days_overdue}}` | Calculated at send time | Integer |
| `{{invoice.payment_link}}` | `invoice.paymentLinkUrl` | URL or empty |
| `{{business.sender_name}}` | `business.senderName` | String |

## Channels

| Channel | Provider | Recipient | Notes |
|---------|----------|-----------|-------|
| `email` | Resend | `customer.contactEmail` | Append `business.emailSignature` |
| `sms` | Twilio | `customer.contactPhone` | Body only, no subject |
| `email_and_sms` | Both | Both | Create two message records |

## Owner Alerts

When `step.isOwnerAlert = true`, send to `business.senderEmail` instead of customer. This is for escalation steps (e.g., "Alert the business owner that this invoice is severely overdue").

## Message Record

After successful send, create:

```typescript
{
  id: generatedUUID,
  sequenceRunId: run.id,
  sequenceStepId: step.id,
  invoiceId: invoice.id,
  customerId: customer.id,
  businessId: business.id,
  channel: 'email' | 'sms',
  recipientEmail: email | null,
  recipientPhone: phone | null,
  subject: renderedSubject | null,
  body: renderedBody,
  status: 'sent',
  externalMessageId: resendId | twilioSid,
  sentAt: now
}
```

## Step Advancement

After sending:

1. Find next step: `step_order = current_step.step_order + 1`
2. If next step exists:
   - `current_step_id = nextStep.id`
   - `next_send_at = now + nextStep.delayDays` (adjusted to 9 AM, skip weekends)
3. If no next step:
   - `status = 'completed'`
   - `completed_at = now`
   - `current_step_id = null`
   - `next_send_at = null`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Resend/Twilio API error | Retry job (3 attempts: 1min, 5min, 15min backoff) |
| Missing `contactEmail` for email step | Skip channel, log warning, still advance step |
| Missing `contactPhone` for SMS step | Skip channel, log warning, still advance step |
| Run status changed (no longer active) | Skip silently (payment may have come in) |
| `email_and_sms` partial failure | Retry only the failed channel |

## Concurrency

- Tick job: Single instance (default)
- Send jobs: Concurrency 10 (process up to 10 messages simultaneously)

## Idempotency

Before sending, verify:
1. `sequence_run.status` is still `'active'`
2. No message already exists for this run + step combination

This prevents duplicate sends if a job is retried after partial completion.
