# Deferred Frontend Work

Frontend tasks that are **designed/wanted but blocked** because the page or surface they belong to doesn't exist yet. When that surface gets built, pick the matching note up.

**Check this file before starting any frontend task.** If the task you're doing relates to a note here — or your change touches a page/feature mentioned below — account for it (build the deferred piece too, or at least wire the seam so it's not forgotten).

---

## Settings → Business profile edit page
**Blocked on:** the Settings page (currently a stub: `apps/web/src/pages/settings.tsx` returns `<h1>Settings</h1>`).
**Backend: ready** — `PATCH /v1/businesses/:id` (`business.controller.ts`) accepts `name`, `senderName`, `senderEmail`, `emailSignature` (nullable), `timezone` (IANA), all optional.
**To build when Settings exists:**
- A Business profile form (name, sender name, sender email, timezone, **email signature**) wired to `PATCH /v1/businesses/:id` via a new `updateBusinessSettings` api fn + `useUpdateBusinessSettings` mutation.
- Loads current values (reuse `useBusinesses`).
- Once this exists: optionally add a one-line note on onboarding ("You can edit this later in Settings"). Not before — would be a dead-end promise.

## Multi-business — Part 2 (in-app)
**Blocked on:** the Settings page + the app being multi-business-aware. (Part 1 = the onboarding "add another business" flow, which IS being built now.)
**Backend: ready** — Account→Business is one-to-many; `Account.maxBusinesses` is synced from plan by the Stripe webhook (agency = 5, growth/starter = 1); `create-business` enforces the limit; `GET /v1/businesses` lists; `POST /v1/connections/authorize` connects each business. No backend work needed.
**To build:**
- **Business switcher** — sidebar dropdown listing the account's businesses + a selected-business indicator.
- **Selected-business state** — a Zustand store (`stores/`) holding the current business id; persists across navigation.
- **Scope every query to the selected business** — dashboard, invoices, customers, sequences, etc. currently assume a single business; thread the selected business id through their query hooks / API calls.
- **Settings → "Connect another business"** — reuse the onboarding create + OAuth flow per business, gated on `account.maxBusinesses > current count`.
