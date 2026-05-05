# Nudge — Project Instructions

Nudge is a B2B accounts receivable follow-up automation tool. Customers connect their invoicing system, define automated follow-up sequences, and Nudge handles reminders, escalations, and payment tracking.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | NestJS 11, Express, TypeScript |
| Background jobs | NestJS + BullMQ, Redis |
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL 18, Prisma ORM |
| Auth | Clerk |
| Email | Resend |
| SMS | Twilio |
| AI | Claude API (Anthropic SDK) |
| State management | Zustand (client), TanStack Query (server) |
| Validation | Zod |
| Monorepo | Turborepo, pnpm workspaces |

## Monorepo Structure

```
apps/
  api/          → NestJS REST API (port 3000)
  worker/       → NestJS BullMQ background worker
  web/          → React + Vite frontend (port 5173)
packages/
  database/     → Prisma schema, migrations, client
  shared/       → Shared types, Zod schemas, constants, utils
  eslint-config/→ Shared ESLint configuration
```

## Architecture Rules

- All API endpoints live in `apps/api`
- All background jobs live in `apps/worker`
- All frontend code lives in `apps/web`
- Shared types, Zod schemas, and constants live in `packages/shared`
- Prisma schema and migrations live in `packages/database`
- Never import from `apps/*` into `packages/*`
- Never import between apps (`apps/api` must not import from `apps/worker`)

## Commands

```bash
pnpm dev                # Start all apps
pnpm build              # Build everything
pnpm lint               # Lint everything
pnpm typecheck          # Type-check everything
pnpm test               # Run all tests

# Per-app
pnpm --filter @nudge/api dev
pnpm --filter @nudge/web dev
pnpm --filter @nudge/worker dev

# Database
pnpm --filter @nudge/database db:migrate
pnpm --filter @nudge/database db:push
pnpm --filter @nudge/database db:studio
pnpm --filter @nudge/database db:seed
```

## Infrastructure

```bash
docker compose up -d    # Start PostgreSQL + Redis
```

- PostgreSQL: `localhost:5432` (user: postgres, pass: postgres, db: nudge)
- Redis: `localhost:6379`

## Rules

Detailed coding rules are in `.claude/rules/` and are loaded automatically:

- `backend.nestjs.rule.md` — Onion architecture, modules, DI, Prisma, BullMQ
- `frontend.react.rule.md` — ViewModel pattern, pages, queries, components
- `naming.rule.md` — File, class, variable, database, and route naming
- `forbidden.rule.md` — Banned patterns and libraries
- `testing.rule.md` — Test frameworks, conventions, what to test where
- `pr-size.rule.md` — Per-PR file cap (≤16 target, ≤20 hard) and Part-N split process
