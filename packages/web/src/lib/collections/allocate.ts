/**
 * Cross-section dedup for the Collections hub (frozen UX rule: every book
 * lands on exactly ONE shelf). Ported from `allocate()` in the frozen
 * `collections-app.jsx`: pools are listed in relevance priority; each shelf
 * greedily takes the first unused ids, so a book sits in its strongest
 * category and the rest fill with the next-best candidates.
 */

export interface AllocationSpec<T> {
  readonly key: string;
  /** How many items this shelf takes. */
  readonly take: number;
  /** Candidate items in the section's own relevance order. */
  readonly pool: readonly T[];
}

/**
 * Greedy cross-section allocation. Specs are processed in priority order
 * (gems → znyzhky → obrane → novynky → popular on the hub); an item used by
 * an earlier shelf never repeats on a later one.
 */
export function allocate<T extends { readonly id: string }>(
  specs: readonly AllocationSpec<T>[],
): Record<string, T[]> {
  const used = new Set<string>();
  const out: Record<string, T[]> = {};
  for (const spec of specs) {
    const picked: T[] = [];
    for (const item of spec.pool) {
      if (picked.length >= spec.take) break;
      if (used.has(item.id)) continue;
      used.add(item.id);
      picked.push(item);
    }
    out[spec.key] = picked;
  }
  return out;
}
