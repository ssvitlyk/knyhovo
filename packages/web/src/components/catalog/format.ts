/** NO-BREAK SPACE — thousands separator that never wraps mid-number. */
const NBSP = ' ';

/**
 * Group a book count with non-breaking thousands separators, e.g.
 * `1840 → "1<nbsp>840"`. Deterministic (no `Intl`/locale dependency) so the
 * curated counts render identically on the server, in tests and across
 * environments — matching the `uk-UA` grouping used in the frozen Collections
 * design.
 */
export function formatCount(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}
