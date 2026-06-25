# Deferred Frontend Work

Frontend tasks that are **designed/wanted but blocked** because the page or surface they belong to doesn't exist yet. When that surface gets built, pick the matching note up.

**Check this file before starting any frontend task.** If the task you're doing relates to a note here — or your change touches a page/feature mentioned below — account for it (build the deferred piece too, or at least wire the seam so it's not forgotten).

---

## Settings → New-invoice auto-enrollment behavior (+ onboarding explanation)
**Blocked on:** the Settings page (stub) + a per-business config field (no backend yet).
**The question (raised during Sequences design):** when a freshly *synced* invoice arrives
from the provider, what happens to it? **Current behavior (automatic):** the worker
`trigger-sequences.use-case.ts` periodically finds overdue invoices that have no run and
auto-starts one, resolving the sequence by `customer.sequenceId` override → customer's tier
sequence → default tier sequence → any active sequence. So **new invoices silently enter a
follow-up sequence once overdue** — the business never opts in per-invoice.
**Why it matters:** (a) users may be surprised/worried that Nudge starts emailing their
clients automatically; (b) it interacts with the **Part 2 "attach specific invoices"** flow —
if someone hand-picks invoices for a sequence, the auto-trigger may still enroll *other* new
invoices via the default tier. Need a clear, configurable story.
**To build when Settings exists:**
- A business-level **auto-enroll toggle/policy** (e.g. "Automatically start follow-ups on new
  overdue invoices: on / off / only for customers in a tier"). Needs a new backend field on
  Business + the worker `trigger-sequences` resolution to honor it.
- **Onboarding:** explain the auto-follow-up default up front (and let them turn it off from
  scratch) so no one is blindsided. May require changing the onboarding flow to surface this.
- Decide precedence: explicit per-invoice/customer attachment vs. the auto-default — which wins.
**Seam now:** sequence selection lives in `apps/worker/.../sequence-trigger/` (worker) and
`apps/api/.../invoices/application/start-follow-up.use-case.ts` (manual start). Both resolve
sequence the same way; a config gate would live at those resolution points.

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

## Get Paid page (overdue worklist) — landing screen
**Blocked on:** Stitch designs (in progress) + the start-follow-up endpoint
(backend being built now — see `docs/superpowers/specs/2026-06-22-get-paid-start-follow-up-design.md`).
**Backend: being built** — `POST /v1/invoices/:id/start-follow-up` creates a
`SequenceRun` on the resolved default sequence. Template preview reuses the existing
`POST /v1/sequences/:id/steps/:stepId/preview`. Overdue invoice list reuses
`GET /v1/invoices` (status filter).
**To build when designs land:**
- A `/get-paid` page: table of **overdue invoices only**, sorted by amount desc,
  red/urgency styling; thin red total strip on top; row expands to invoice detail;
  per-row **Start follow-up** button → modal (template preview + Send & start sequence,
  **no** payment-link/channel toggles) wired to the start-follow-up endpoint.
- **Landing route swap:** make `/get-paid` the post-onboarding landing route (demote
  `/dashboard`) in `apps/web/src/App.tsx`.

## Sequences editor UI
**Blocked on:** nothing technical — the page is a stub
(`apps/web/src/pages/sequences.tsx` returns `<h1>Sequences</h1>`).
**Backend: ready** — full CRUD: list/get/create/update/delete sequences; add/update/
delete/reorder steps (subject, body, channel, delay); `POST /v1/sequences/:id/steps/:stepId/preview`.
**To build:** sequences list + sequence editor (steps, channels, delays, template
text) wired to the sequences API. Lets users change their follow-up sequences after
the Get Paid one-click start uses the default.

## Templates editor UI
**Blocked on:** no templates page/route exists.
**Backend: ready** — full CRUD: `GET/POST/PATCH/DELETE /v1/templates`,
`POST /v1/templates/generate` (AI draft), attach/detach to customer.
**To build:** a templates page (list + create/edit form, optional AI-generate) wired to
the templates API. Complements the Sequences editor.

## Invoice detail page (row click target)
**Blocked on:** no invoice detail page / route yet (`/invoices/:id`).
**Backend: ready** — `GET /v1/invoices/:id` returns full `InvoiceDetail`.
The Reports aging table + Dashboard would link rows to it. Rows are currently
**non-clickable** (linking to a missing route bounced users to /dashboard).
**To build:** an invoice detail page at `/invoices/:id`, then re-enable row
click in `aging-report-table.tsx` (navigate to `/invoices/${id}`) and wire the
detail view model to `getInvoice`.
