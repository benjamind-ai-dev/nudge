# Message Send Job — Implementation Plan

## Overview

Implement the message-send BullMQ job that sends follow-up emails/SMS for overdue invoices.

## Architecture

```
apps/worker/src/modules/message-send/
├── domain/
│   ├── message-send.repository.ts      # Repository interface
│   └── template.service.ts             # Template rendering interface
├── application/
│   ├── enqueue-ready-runs.use-case.ts  # Tick: query & enqueue
│   └── send-message.use-case.ts        # Send single message
├── infrastructure/
│   ├── message-send.processor.ts       # BullMQ processor
│   ├── prisma-message-send.repository.ts
│   ├── handlebars-template.service.ts  # Template rendering
│   ├── resend-email.service.ts         # Resend integration
│   └── twilio-sms.service.ts           # Twilio integration
└── message-send.module.ts
```

## Implementation Steps

### Phase 1: Domain & Repository

- [x] **1.1** Create `message-send.repository.ts` interface
  - `findRunsReadyToSend(): Promise<ReadyRun[]>`
  - `findRunById(id: string): Promise<RunWithDetails | null>`
  - `findNextStep(sequenceId: string, currentOrder: number): Promise<Step | null>`
  - `messageExistsForRunStep(runId: string, stepId: string): Promise<boolean>`
  - `createMessage(data: CreateMessageData): Promise<Message>`
  - `advanceRunToNextStep(runId: string, nextStepId: string, nextSendAt: Date): Promise<void>`
  - `completeRun(runId: string): Promise<void>`

- [x] **1.2** Create `template.service.ts` interface
  - `render(template: string, data: TemplateData): string`

### Phase 2: Infrastructure — Repository

- [x] **2.1** Implement `prisma-message-send.repository.ts`
  - Query with joins: sequence_runs → sequence_steps → invoices → customers → businesses
  - Include all fields needed for template rendering
  - Use transaction for message creation + step advancement

### Phase 3: Infrastructure — Template Service

- [x] **3.1** Implement `handlebars-template.service.ts`
  - In-memory cache: `Map<string, HandlebarsTemplateDelegate>`
  - Register helpers: `formatCurrency`, `formatDate`
  - Compile on first use, cache by stepId

- [x] **3.2** Create `TemplateData` type with all variables:
  ```typescript
  interface TemplateData {
    customer: { company_name, contact_name }
    invoice: { invoice_number, amount, balance_due, due_date, days_overdue, payment_link }
    business: { sender_name }
  }
  ```

### Phase 4: Infrastructure — Email/SMS Services

- [x] **4.1** Implement `resend-email.service.ts`
  - Inject Resend client (already exists in codebase?)
  - Send with: from, to, subject, html body
  - Return `externalMessageId` from response

- [x] **4.2** Implement `twilio-sms.service.ts`
  - Inject Twilio client (already exists: `apps/worker/src/modules/sms/`)
  - Send with: to, body
  - Return `sid` as `externalMessageId`

### Phase 5: Application — Use Cases

- [x] **5.1** Implement `enqueue-ready-runs.use-case.ts`
  - Query runs where `status = 'active'` and `next_send_at <= now()`
  - For each run, add job to queue: `{ runId: run.id }`
  - Return count of jobs enqueued

- [x] **5.2** Implement `send-message.use-case.ts`
  - Load run with all related data
  - Verify run is still active
  - Check for existing message (idempotency)
  - Determine recipient (customer or owner if `isOwnerAlert`)
  - Render templates
  - Send via appropriate channel(s)
  - Create message record(s)
  - Advance to next step or complete run

### Phase 6: Infrastructure — Processor

- [x] **6.1** Implement `message-send.processor.ts`
  - Handle `message-send-tick`: call `EnqueueReadyRunsUseCase`
  - Handle `send-message`: call `SendMessageUseCase`
  - Configure concurrency: 10 for send-message jobs

### Phase 7: Module & Registration

- [x] **7.1** Create `message-send.module.ts`
  - Register all providers
  - Import dependencies (DatabaseModule, etc.)

- [x] **7.2** Update `repeatable-jobs.service.ts` (already registered)
  - Already registered (every 1 minute) — verify it's correct

- [x] **7.3** Update `app.module.ts`
  - Import `MessageSendModule`

### Phase 8: Testing

- [x] **8.1** Unit tests for `send-message.use-case.ts`
  - Happy path: email sent, message created, step advanced
  - No contact email: skip, log warning, still advance
  - Run no longer active: skip silently
  - Duplicate detection: skip if message exists

- [x] **8.2** Unit tests for `enqueue-ready-runs.use-case.ts`
  - Enqueues correct number of jobs
  - Empty result: no jobs enqueued

- [x] **8.3** Unit tests for `handlebars-template.service.ts`
  - Variables render correctly
  - Currency formatting
  - Date formatting
  - Caching works

- [x] **8.4** Unit tests for processor
  - Routes job types correctly

## Dependencies

- Resend SDK (check if already installed)
- Twilio SDK (already used in `apps/worker/src/modules/sms/`)
- Handlebars (`npm install handlebars`)

## Environment Variables

Verify these exist:
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

## Estimated Scope

| Phase | Effort |
|-------|--------|
| Domain & Repository Interface | Small |
| Prisma Repository | Medium |
| Template Service | Small |
| Email/SMS Services | Small (reuse existing) |
| Use Cases | Medium |
| Processor | Small |
| Module Wiring | Small |
| Tests | Medium |

Total: ~8 points (matches ticket estimate)
