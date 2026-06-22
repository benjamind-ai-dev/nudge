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

## Multi-business — in-app display (dashboard)
**Blocked on:** dashboard multi-business design. (The onboarding multi-connect for agency IS being built now — that's the separate, current piece.)
**Backend: ready** — Account→Business is one-to-many; `Account.maxBusinesses` synced from plan by the Stripe webhook (agency = 5, growth/starter = 1); `create-business` enforces the limit; `GET /v1/businesses` lists; `POST /v1/connections/authorize` connects each. No backend work needed.
**To build (NOT a business switcher — a combined, labeled view):**
- When an account has multiple connected businesses, the dashboard / invoice / customer views should show **which business + provider** each row belongs to (a provider/business label or column), and present multiple providers cleanly.
- Enhance the Stitch design prompts so multiple providers/businesses render nicely in those views.
- **Seam exists:** `apps/web/src/lib/hooks/use-active-business-id.ts` resolves the single business the dashboard renders for and already exposes `hasMultiple`. The dashboard (built 2026-06-22) renders for that one business only. When the multi-business design lands, branch on `hasMultiple` there (and swap the "first connected" pick for a selected-business id).

## Multi-business — Settings "connect another business"
**Blocked on:** the Settings page.
- From Settings, let an agency connect/add another business later (reuse the onboarding create + OAuth flow), gated on `account.maxBusinesses > current count`. Complements the onboarding multi-connect.

## Invoice detail page (row click target)
**Blocked on:** no invoice detail page / route yet (`/invoices/:id`).
**Backend: ready** — `GET /v1/invoices/:id` returns full `InvoiceDetail`.
The Reports aging table + Dashboard would link rows to it. Rows are currently
**non-clickable** (linking to a missing route bounced users to /dashboard).
**To build:** an invoice detail page at `/invoices/:id`, then re-enable row
click in `aging-report-table.tsx` (navigate to `/invoices/${id}`) and wire the
detail view model to `getInvoice`.
