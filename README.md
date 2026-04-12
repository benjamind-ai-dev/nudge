# Nudge

Automated accounts receivable platform for SMBs.

## Prerequisites

- **Node.js** >= 20 ([install](https://nodejs.org/))
- **pnpm** >= 9 (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** & Docker Compose ([install](https://docs.docker.com/get-docker/))

## Getting Started

```bash
# Clone the repository
git clone git@github.com:your-org/nudge.git
cd nudge

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Set up environment
cp .env.example .env

# Run database migrations
pnpm --filter @nudge/database db:migrate

# Start all apps in dev mode
pnpm dev
```

This starts:
- **API** on http://localhost:3000 (NestJS)
- **Worker** in the background (BullMQ processors)
- **Web** on http://localhost:5173 (Vite + React)

## Project Structure

```
nudge/
├── apps/
│   ├── api/            # NestJS REST API
│   ├── worker/         # NestJS BullMQ worker
│   └── web/            # React + Vite frontend
├── packages/
│   ├── shared/         # Shared types, schemas, constants, utilities
│   ├── database/       # Prisma schema, migrations, client
│   └── eslint-config/  # Shared ESLint configuration
├── docker-compose.yml  # Local PostgreSQL + Redis
├── turbo.json          # Turborepo task configuration
└── pnpm-workspace.yaml # pnpm workspace definition
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm typecheck` | Type-check all apps and packages |
| `pnpm test` | Run tests across all apps and packages |

### Per-app commands

```bash
pnpm --filter @nudge/api dev        # Start only the API
pnpm --filter @nudge/web dev        # Start only the web app
pnpm --filter @nudge/database db:studio  # Open Prisma Studio
```

## Environment Variables

See `.env.example` for all required variables with descriptions.
