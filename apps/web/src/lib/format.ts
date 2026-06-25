/**
 * Money + date formatting for the web app. Mirrors `@nudge/shared`'s formatters
 * — the web bundle doesn't depend on that package (it ships from `dist`), so we
 * keep a local copy rather than wire cross-package build references for a UI PR.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Formats cents as whole-dollar currency — no decimals. E.g. 123456 → "$1,235". */
export function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
