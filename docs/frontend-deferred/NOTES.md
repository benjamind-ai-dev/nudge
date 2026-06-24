# Deferred Frontend Work

Frontend tasks that are **designed/wanted but blocked** because the page or surface they belong to doesn't exist yet. When that surface gets built, pick the matching note up.

**Check this file before starting any frontend task.** If the task you're doing relates to a note here — or your change touches a page/feature mentioned below — account for it (build the deferred piece too, or at least wire the seam so it's not forgotten).

---

## Differentiate Get Paid / Reports / Dashboard (they look too alike)
**Problem:** Get Paid and Reports both render the same filtered-invoice **table** with the same `InvoiceFilterBar` + density, so they feel like the same page. Dashboard is distinct (widgets) but the trio blurs.
**Direction (lean each into its job, not three look-alike tables):**
- **Get Paid = ACT** — urgent, focused, action-first (chase + one-click follow-up). Should NOT read as a generic data table; emphasize the action + urgency.
- **Reports = ANALYZE** — aging breakdown / trends / export up front; the table is secondary to the visualization.
- **Dashboard = OVERVIEW** — snapshot (keep).
**Not yet built.** Revisit once the active feature work settles; give each page a distinct identity matched to its purpose.

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
**DONE — built 2026-06-23 (feat/get-paid-page branch).**
`/get-paid` is now the landing route. Table shows overdue invoices sorted by amount
desc; per-row Start follow-up → confirm modal → `POST /v1/invoices/:id/start-follow-up`.
Email history + Next step blocks in the expanded row are still placeholders ("No activity
yet") — waiting on a BE field to expose them (see spec for detail).

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
