---
name: nestjs-expert
description: Use when creating, modifying, or scaffolding NestJS modules, services, controllers, use cases, or domain entities in apps/api or apps/worker. Use when the user asks to build a new feature, add an endpoint, create a background job, or wire up a new domain concept.
---

# NestJS Expert — Nudge Module Patterns

## Overview

This skill provides the exact code patterns for building NestJS modules in the Nudge monorepo. Every module follows an onion architecture: domain (pure logic) → application (use cases) → infrastructure (Prisma, queues) → API (controllers) or processors (worker).

**CLAUDE.md has the rules. This skill has the code.**

## When to Use

- Creating a new feature module in `apps/api` or `apps/worker`
- Adding an endpoint to an existing module
- Adding a background job processor
- Wiring domain logic with NestJS dependency injection
- Creating DTOs, entities, repository interfaces, or use cases

## Module Scaffolding

When creating a new module (e.g., `invoice`), create this structure:

```
src/modules/invoice/
  domain/
    invoice.entity.ts
    invoice.errors.ts
    invoice.repository.ts
  application/
    create-invoice.use-case.ts
  infrastructure/
    prisma-invoice.repository.ts
  dto/
    create-invoice.dto.ts
  invoice.controller.ts       # API only
  invoice.module.ts
```

For worker modules, replace the controller with a processor:

```
src/modules/invoice-reminder/
  invoice-reminder.processor.ts
  invoice-reminder.module.ts
```

Worker modules often import domain and application layers from a shared location or re-use use case classes.

## Layer 1 — Domain Entity

Pure TypeScript. Zero framework imports. All business rules live here.

```typescript
// src/modules/invoice/domain/invoice.entity.ts

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID',
  VOID = 'VOID',
}

export class Invoice {
  constructor(
    public readonly id: string,
    public readonly businessId: string,
    public readonly customerId: string,
    public readonly amountCents: number,
    public readonly dueDate: Date,
    public status: InvoiceStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  isOverdue(): boolean {
    return this.status === InvoiceStatus.SENT && new Date() > this.dueDate;
  }

  markPaid(paidAmountCents: number): void {
    if (this.status === InvoiceStatus.PAID) {
      throw new InvoiceAlreadyPaidError(this.id);
    }
    if (paidAmountCents < this.amountCents) {
      throw new InsufficientPaymentError(this.id, this.amountCents, paidAmountCents);
    }
    this.status = InvoiceStatus.PAID;
    this.updatedAt = new Date();
  }

  canSendReminder(): boolean {
    return (
      this.status === InvoiceStatus.SENT ||
      this.status === InvoiceStatus.OVERDUE
    );
  }
}
```

Key rules:
- Entity constructor takes all fields — no partial objects
- Business methods throw domain errors, not HTTP exceptions
- All money is `number` representing **cents**
- `businessId` is always present — every entity belongs to a tenant

## Layer 1 — Domain Errors

```typescript
// src/modules/invoice/domain/invoice.errors.ts

export class InvoiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} not found`);
    this.name = 'InvoiceNotFoundError';
  }
}

export class InvoiceAlreadyPaidError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} is already paid`);
    this.name = 'InvoiceAlreadyPaidError';
  }
}

export class InsufficientPaymentError extends Error {
  constructor(invoiceId: string, expectedCents: number, receivedCents: number) {
    super(
      `Invoice ${invoiceId} requires ${expectedCents} cents but received ${receivedCents}`,
    );
    this.name = 'InsufficientPaymentError';
  }
}
```

Key rules:
- Extend `Error`, not NestJS `HttpException`
- Domain errors are mapped to HTTP status codes in the controller or a filter — not here

## Layer 1 — Repository Interface

```typescript
// src/modules/invoice/domain/invoice.repository.ts

import { Invoice } from './invoice.entity';

export interface InvoiceRepository {
  findById(businessId: string, id: string): Promise<Invoice | null>;
  findByCustomer(businessId: string, customerId: string): Promise<Invoice[]>;
  findOverdue(businessId: string): Promise<Invoice[]>;
  save(invoice: Invoice): Promise<void>;
}

// NestJS DI token
export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');
```

Key rules:
- Interface only — no implementation
- Every query method takes `businessId` as the **first parameter**
- Use a `Symbol` for the DI injection token
- Return domain entities, not Prisma types

## Layer 2 — Use Case

```typescript
// src/modules/invoice/application/record-payment.use-case.ts

import { Inject, Injectable } from '@nestjs/common';
import {
  InvoiceRepository,
  INVOICE_REPOSITORY,
} from '../domain/invoice.repository';
import { InvoiceNotFoundError } from '../domain/invoice.errors';

@Injectable()
export class RecordPaymentUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoices: InvoiceRepository,
  ) {}

  async execute(businessId: string, invoiceId: string, amountCents: number): Promise<void> {
    const invoice = await this.invoices.findById(businessId, invoiceId);
    if (!invoice) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    invoice.markPaid(amountCents);
    await this.invoices.save(invoice);
  }
}
```

Key rules:
- One use case = one public `execute` method
- `businessId` is always the first parameter of `execute`
- Depends on domain interfaces via `@Inject`, never on infrastructure directly
- Orchestrates domain logic — doesn't contain business rules itself
- NestJS `@Injectable()` is the only framework decorator allowed here

## Layer 3 — Infrastructure (Prisma Repository)

```typescript
// src/modules/invoice/infrastructure/prisma-invoice.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@nudge/database';
import { Invoice, InvoiceStatus } from '../domain/invoice.entity';
import { InvoiceRepository } from '../domain/invoice.repository';

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(businessId: string, id: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCustomer(businessId: string, customerId: string): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findOverdue(businessId: string): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: InvoiceStatus.SENT,
        dueDate: { lt: new Date() },
      },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(invoice: Invoice): Promise<void> {
    await this.prisma.invoice.upsert({
      where: { id: invoice.id },
      update: {
        status: invoice.status,
        updatedAt: invoice.updatedAt,
      },
      create: {
        id: invoice.id,
        businessId: invoice.businessId,
        customerId: invoice.customerId,
        amountCents: invoice.amountCents,
        dueDate: invoice.dueDate,
        status: invoice.status,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
    });
  }

  private toDomain(row: {
    id: string;
    businessId: string;
    customerId: string;
    amountCents: number;
    dueDate: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): Invoice {
    return new Invoice(
      row.id,
      row.businessId,
      row.customerId,
      row.amountCents,
      row.dueDate,
      row.status as InvoiceStatus,
      row.createdAt,
      row.updatedAt,
    );
  }
}
```

Key rules:
- `implements InvoiceRepository` — must satisfy the domain interface
- Every Prisma query includes `businessId` in the `where` clause
- `toDomain()` maps Prisma rows to domain entities — this is the only place Prisma types appear
- Use `findFirst` with `{ id, businessId }` instead of `findUnique` with just `{ id }` to enforce tenant scoping

## Layer 4 — DTOs (Zod)

```typescript
// src/modules/invoice/dto/create-invoice.dto.ts

import { z } from 'zod';

export const createInvoiceSchema = z.object({
  customerId: z.string().cuid(),
  amountCents: z.number().int().positive(),
  dueDate: z.coerce.date().refine((d) => d > new Date(), {
    message: 'Due date must be in the future',
  }),
});

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
```

Key rules:
- Zod schema is the source of truth — the type is inferred from it
- Export both the schema (for validation) and the type (for type-checking)
- Money fields validate as `z.number().int().positive()` — integer cents
- Never use `class-validator` decorators

## Layer 4 — Controller

```typescript
// src/modules/invoice/invoice.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common';
import { CreateInvoiceUseCase } from './application/create-invoice.use-case';
import { RecordPaymentUseCase } from './application/record-payment.use-case';
import { createInvoiceSchema, CreateInvoiceDto } from './dto/create-invoice.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('v1/invoices')
export class InvoiceController {
  constructor(
    private readonly createInvoice: CreateInvoiceUseCase,
    private readonly recordPayment: RecordPaymentUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createInvoiceSchema))
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    const invoice = await this.createInvoice.execute(businessId, dto);
    return { data: invoice };
  }

  @Post(':id/payments')
  async pay(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body('amountCents') amountCents: number,
  ) {
    await this.recordPayment.execute(businessId, id, amountCents);
    return { data: { status: 'paid' } };
  }
}
```

Key rules:
- Route prefix is `v1/<resource>` in kebab-case
- `@BusinessId()` is a custom decorator extracting `businessId` from the Clerk session
- Controllers call use cases — they never contain business logic
- Response shape is `{ data: T }` matching the `ApiResponse` type from `@nudge/shared`
- Zod validation via a `ZodValidationPipe` in `common/pipes/`

## Wiring — The Module File

```typescript
// src/modules/invoice/invoice.module.ts

import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { CreateInvoiceUseCase } from './application/create-invoice.use-case';
import { RecordPaymentUseCase } from './application/record-payment.use-case';
import { INVOICE_REPOSITORY } from './domain/invoice.repository';
import { PrismaInvoiceRepository } from './infrastructure/prisma-invoice.repository';

@Module({
  controllers: [InvoiceController],
  providers: [
    CreateInvoiceUseCase,
    RecordPaymentUseCase,
    {
      provide: INVOICE_REPOSITORY,
      useClass: PrismaInvoiceRepository,
    },
  ],
  exports: [CreateInvoiceUseCase, RecordPaymentUseCase],
})
export class InvoiceModule {}
```

Key rules:
- The module is where dependency inversion happens — `provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository`
- Export use cases if other modules or the worker need them
- Never export infrastructure classes directly

## Worker Processor Pattern

```typescript
// apps/worker/src/modules/invoice-reminder/invoice-reminder.processor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@nudge/shared';

@Processor(QUEUE_NAMES.INVOICE_REMINDER)
export class InvoiceReminderProcessor extends WorkerHost {
  async process(job: Job<{ businessId: string; invoiceId: string }>): Promise<void> {
    const { businessId, invoiceId } = job.data;

    // Use cases and domain logic here
    // businessId is always present in job data
  }
}
```

Key rules:
- Queue name imported from `@nudge/shared` — never a string literal
- Extend `WorkerHost` and implement `process`
- Job data always includes `businessId`

## Common Utilities in `src/common/`

### Zod Validation Pipe

```typescript
// src/common/pipes/zod-validation.pipe.ts

import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Request validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
```

### BusinessId Decorator

```typescript
// src/common/decorators/business-id.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const BusinessId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Clerk middleware attaches auth to the request
    const businessId = request.auth?.orgId;
    if (!businessId) {
      throw new Error('No business_id in session — is Clerk middleware configured?');
    }
    return businessId;
  },
);
```

## Quick Reference

| Task | Pattern |
|---|---|
| New module | Scaffold all 4 layers + module file |
| New endpoint | Add use case → add DTO → add controller method → register in module |
| New background job | Add processor extending `WorkerHost` → register in worker module |
| New domain rule | Add method to entity → throw domain error on violation |
| New query | Add method to repository interface → implement in Prisma repo |
| Cross-module dependency | Export use case from source module → import module in consumer |

## Common Mistakes

| Mistake | Fix |
|---|---|
| Business logic in controller | Move to domain entity or use case |
| Prisma types leaking into domain | Use `toDomain()` mapper in infrastructure |
| Missing `businessId` in query | Every repo method takes `businessId` first |
| `findUnique({ id })` without tenant scope | Use `findFirst({ id, businessId })` |
| `class-validator` decorators | Use Zod schema + `ZodValidationPipe` |
| Hardcoded queue name string | Import from `@nudge/shared` `QUEUE_NAMES` |
| `HttpException` in domain layer | Throw plain `Error` subclass, map in controller/filter |
| Use case calling Prisma directly | Inject repository interface via `@Inject(SYMBOL)` |
