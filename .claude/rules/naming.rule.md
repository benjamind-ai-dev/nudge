# Naming Conventions

| What | Convention | Example |
|---|---|---|
| Files | kebab-case | `invoice-sync.service.ts` |
| Classes | PascalCase | `InvoiceSyncService` |
| Functions / variables | camelCase | `syncInvoices` |
| Database tables | snake_case | `sequence_runs` |
| API routes | kebab-case, versioned | `/v1/sequence-runs` |
| BullMQ queue names | kebab-case | `invoice-sync` |
| Environment variables | SCREAMING_SNAKE_CASE | `SENDGRID_API_KEY` |
| Prisma models | PascalCase | `SequenceRun` |
| Prisma `@@map()` | snake_case | `@@map("sequence_runs")` |
| Prisma `@map()` | snake_case | `@map("created_at")` |
| React components | PascalCase | `InvoiceTable` |
| React component files | kebab-case | `invoice-table.tsx` |
| React hooks | camelCase with `use` prefix | `useInvoicesViewModel` |
| React hook files | kebab-case | `use-invoices.ts` |
| Zod schemas | camelCase with `Schema` suffix | `createInvoiceSchema` |
| DTO types | PascalCase with `Dto` suffix | `CreateInvoiceDto` |
| View model hooks | camelCase with `ViewModel` suffix | `useInvoicesViewModel()` |
| View model files | kebab-case with `.view-model` suffix | `invoices.view-model.ts` |
| Page files | kebab-case with `.page` suffix | `invoices.page.tsx` |
| API fetch files | kebab-case with `.api` suffix | `invoices.api.ts` |
| Zustand stores | kebab-case with `.store` suffix | `ui.store.ts` |
| Use case classes | PascalCase with `UseCase` suffix | `RecordPaymentUseCase` |
| Repository interfaces | PascalCase with `Repository` suffix | `InvoiceRepository` |
| Domain entity files | kebab-case with `.entity` suffix | `invoice.entity.ts` |
| Domain error files | kebab-case with `.errors` suffix | `invoice.errors.ts` |
| Test files (backend) | same name with `.spec.ts` | `invoice.controller.spec.ts` |
| Test files (frontend) | same name with `.test.tsx` | `invoice-table.test.tsx` |
