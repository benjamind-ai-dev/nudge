/**
 * Shared mapping utilities for InvoiceSyncProvider implementations.
 * Pure TypeScript — zero framework imports.
 */

/** Default currency for canonical invoices when the provider omits one. */
export const DEFAULT_CURRENCY = "USD";

/**
 * Parse a provider date string into a JS Date.
 * Accepts: ISO 8601 (e.g. "2026-01-05T10:00:00Z", "2026-02-01"),
 *          Xero's legacy .NET format (e.g. "/Date(1706140800000+0000)/").
 * Returns null for empty/invalid input.
 */
export function parseProviderDate(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;

  // Xero .NET legacy format: /Date(milliseconds+offset)/
  const dotNetMatch = /^\/Date\((\d+)[+-]\d{4}\)\/$/.exec(value);
  if (dotNetMatch) {
    const ms = parseInt(dotNetMatch[1], 10);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Also accept bare /Date(milliseconds)/ without offset
  const dotNetBareMatch = /^\/Date\((\d+)\)\/$/.exec(value);
  if (dotNetBareMatch) {
    const ms = parseInt(dotNetBareMatch[1], 10);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Convert a provider's decimal-as-number or decimal-as-string money value
 * into integer cents. Uses Math.round to handle IEEE 754 drift.
 * Accepts: number (500.25 → 50025), string ("500.25" → 50025),
 *          null/undefined → 0.
 */
export function centsFromDecimal(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Build a contact display name from optional first/last parts.
 * Falls back to `fallback` if both parts are empty/whitespace.
 * Returns null if fallback is also empty.
 */
export function joinContactName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback?: string | null,
): string | null {
  const parts = [firstName, lastName]
    .map((p) => p?.trim() ?? "")
    .filter((p) => p.length > 0);

  if (parts.length > 0) return parts.join(" ");

  const trimmedFallback = fallback?.trim() ?? "";
  return trimmedFallback.length > 0 ? trimmedFallback : null;
}
