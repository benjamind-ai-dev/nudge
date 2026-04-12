---
paths:
  - "apps/api/**/*"
  - "apps/worker/**/*"
---

# Backend Rules — NestJS (API + Worker)

## App Folder Structure

Both `apps/api` and `apps/worker` follow the same layout:

```
src/
  common/           → Cross-cutting concerns shared within the app
    logger/
    filters/
    interceptors/
    guards/
    decorators/
    pipes/
    utils/
  modules/           → Feature modules (one folder per domain concept)
    invoice/
      domain/             → Pure business entities and interfaces
        invoice.entity.ts
        invoice.errors.ts
        invoice.repository.ts    (interface only)
      application/        → Use cases / orchestration
        create-invoice.use-case.ts
        record-payment.use-case.ts
      infrastructure/     → Interface implementations (Prisma repos, producers)
        prisma-invoice.repository.ts
      dto/                → Request/response DTOs (Zod schemas)
        create-invoice.dto.ts
      invoice.controller.ts   (API only)
      invoice.module.ts
```

## Onion Architecture Principles

- Each module is a self-contained onion: `domain/` → `application/` → `infrastructure/`
- `domain/` has zero framework imports — pure TypeScript only
- `application/` depends on domain interfaces, never on infrastructure directly
- `infrastructure/` implements domain interfaces (e.g., `InvoiceRepository`)
- The NestJS module file wires interfaces to implementations via DI
- Worker modules have processors (extending `WorkerHost`) instead of controllers

## Validation

- Use **Zod** for ALL validation — request DTOs, env parsing, config schemas
- Use a `ZodValidationPipe` in `common/pipes/` to validate request bodies
- DTOs export both the Zod schema and the inferred TypeScript type
- Never use `class-validator` or `class-transformer`

## Database

- Use **Prisma** for ALL database access
- Never use raw SQL except for complex analytics queries in reporting endpoints
- Every query that touches tenant data **must** include `WHERE business_id = ?`
- This is a security requirement, not a suggestion
- Repository interfaces use a `Symbol` token for NestJS DI
- Use `findFirst({ id, businessId })` over `findUnique({ id })` to enforce tenant scoping
- Infrastructure repos have a `toDomain()` mapper — Prisma types never leak into domain

## Authentication

- Use **Clerk** for all auth — middleware extracts `business_id` from the session
- Use a custom `@BusinessId()` param decorator in `common/decorators/`
- Never use Passport.js, never roll custom JWT handling

## Money

- All monetary values stored as **integers in cents** — never floats, never dollars
- Use `formatCents()` from `@nudge/shared` for display

## Timestamps

- All timestamps in **UTC**
- Use `TIMESTAMPTZ` (via `@db.Timestamptz` in Prisma) for all date columns
- Use `date-fns` for formatting and manipulation

## Background Jobs

- Use **BullMQ** queues via `@nudge/shared` queue name constants
- Never use `@nestjs/schedule`, `setTimeout`, or cron-based scheduling
- Import queue names from `@nudge/shared` — never hardcode queue name strings
- Worker processors extend `WorkerHost` and implement `process(job)`
- Job data always includes `businessId`

## Error Handling

- API returns a standard error envelope: `{ statusCode, error, message, details? }`
- Use NestJS exception filters in `common/filters/`
- Domain layer throws plain `Error` subclasses — never `HttpException`
- Controllers or filters map domain errors to HTTP status codes

## AI Integration

- All Claude API calls go through the shared `callClaude()` wrapper
- Never call the Anthropic SDK directly from a service
- **PII must be anonymized before sending to Claude API** — this is a compliance requirement

## Environment Variables

- Parsed and validated with Zod at startup
- Never access `process.env` directly in services — use a typed config module

## API Routes

- All routes prefixed with `v1/` (e.g., `v1/invoices`)
- Routes are kebab-case (e.g., `v1/sequence-runs`)
- Controllers return `{ data: T }` matching the `ApiResponse` type from `@nudge/shared`
