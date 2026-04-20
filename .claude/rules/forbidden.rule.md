# Forbidden Patterns

These will be rejected in code review. Do not use them.

## Libraries

- **`class-validator`** or **`class-transformer`** — use Zod for all validation
- **`Passport.js`** or custom JWT verification — use Clerk
- **`@nestjs/schedule`** for recurring work — use BullMQ
- **`TypeORM`**, **`Sequelize`**, or any ORM other than Prisma
- **`axios`** in frontend — use the `api/client.ts` fetch wrapper

## Patterns

- **Storing money as `float`, `decimal`, or `Decimal`** — use integer cents
- **Database queries without `business_id` scoping** on tenant data — security requirement
- **`findUnique({ id })`** without tenant scoping — use `findFirst({ id, businessId })`
- **Logging OAuth tokens, API keys, or PII** — redact before logging
- **Calling Claude API without anonymizing PII first** — compliance requirement
- **`localStorage`** in React — use Zustand or TanStack Query
- **`React.useContext`** for state management — use Zustand
- **Hardcoded queue name strings** — import from `@nudge/shared` `QUEUE_NAMES`
- **`any` type** without a comment explaining why it's necessary
- **Barrel `index.ts` files** inside app modules — import directly from the file
- **`setTimeout`** or `setInterval` for job scheduling — use BullMQ
- **`process.env` access** in services — use a typed Zod-validated config module
- **Raw `fetch()`** in components or view models — use `api/*.api.ts` functions
- **`useState`/`useEffect`** in components for data logic — belongs in the view model
- **`HttpException`** in domain layer — throw plain `Error` subclasses
- **Injecting `PRISMA_CLIENT` in `modules/*/application/` or `modules/*/domain/`** — use a repository interface. Prisma access lives only in `modules/*/infrastructure/` or `common/`.

## Code Style

- No default exports — use named exports everywhere
- No relative imports that go up more than 2 levels (`../../..`) — restructure or use path aliases
- No commented-out code committed to main
- No `console.log` in committed code — use the logger service
