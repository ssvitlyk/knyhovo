export const PAGINATION_ELLIPSIS = '…';

export type PageItem = number | typeof PAGINATION_ELLIPSIS;

/**
 * Frozen pagination algorithm (Search Results v1, verbatim from the reference
 * `search-results.jsx` `getPageItems`):
 *  - ≤ 7 pages → show all, no ellipsis.
 *  - otherwise always show first + last + current ±1 adjacent.
 *  - a single hidden page between two visible pages is filled, not collapsed.
 *  - an ellipsis appears only when the gap is larger than one page.
 */
export function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const visible = new Set<number>([1, total, current]);
  if (current - 1 >= 1) visible.add(current - 1);
  if (current + 1 <= total) visible.add(current + 1);

  const sorted = [...visible].sort((a, b) => a - b);
  const items: PageItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap === 2) items.push(sorted[i - 1] + 1); // fill single hidden page
      else if (gap > 2) items.push(PAGINATION_ELLIPSIS); // ellipsis for larger gaps
    }
    items.push(sorted[i]);
  }
  return items;
}
