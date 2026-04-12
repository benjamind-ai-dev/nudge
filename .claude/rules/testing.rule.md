# Testing Conventions

## Frameworks

| App | Framework | Test file pattern |
|---|---|---|
| `apps/api` | Jest + Supertest | `*.spec.ts` next to source |
| `apps/worker` | Jest | `*.spec.ts` next to source |
| `apps/web` | Vitest + React Testing Library | `*.test.tsx` next to source |
| `packages/shared` | Vitest | `*.spec.ts` next to source |

## What to Test Where

### Backend

- **Domain entities and use cases**: Plain unit tests. No mocks needed — these are pure logic. This is the most important layer to test.
- **Infrastructure (Prisma repos)**: Integration tests against a real test PostgreSQL instance via docker-compose. Never mock Prisma in tests that verify data access.
- **Controllers**: Integration tests with Supertest. Verify HTTP status codes, response shape, and auth guards.
- **BullMQ processors**: Unit test the `process()` method with mock job data.

### Frontend

- **View models**: The primary test target. Test the hook with `renderHook()` — assert on returned state, callbacks, and derived data. Mock the query hooks.
- **Components**: Only test complex components with significant conditional rendering. Simple prop-to-JSX components don't need tests.
- **Pages**: Don't test pages directly — they're just glue. Test the view model instead.
- **API functions**: Don't unit test — these are thin fetch wrappers. Covered by integration/e2e tests.

## Rules

- Test files live next to the source file they test, not in a separate `__tests__/` directory
- Every use case should have at least one test for the happy path and one for each error case
- Domain entity business methods should have tests for valid and invalid state transitions
- Tests should not depend on execution order
- No `sleep()` or timing-dependent assertions — use `waitFor()` or `flush` utilities
- Use factories or builders for test data, not raw object literals repeated across tests
- Test database is a separate PostgreSQL instance — never run tests against the dev database
