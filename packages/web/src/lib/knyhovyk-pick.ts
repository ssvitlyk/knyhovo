/**
 * The wishlist v2.2 «Порада Книговика» curated pick — intentionally NOT wired
 * to the buying-reason engine (frozen decision, `incoming/CLAUDE.md`: "Hero
 * «Порада Книговика» is intentionally NOT wired to this engine — it stays a
 * manually curated pick"). This is a seam for a curator to hand-pick one book;
 * shipping `null` hides the section entirely until it is filled in.
 */
export interface KnyhovykPick {
  /** The canonical book id to feature. */
  readonly bookId: string;
  /**
   * Curator override for the status message body — replaces the derived
   * status copy (e.g. the goal/deal/drop message text) when present.
   */
  readonly note?: string;
}

/**
 * The current curated pick, or `null` when no curator has filled it in yet
 * (product decision №4: ship null — the section is hidden, not stubbed with
 * mock data). Set this to a real `{ bookId }` when a curator makes a choice.
 */
export const KNYHOVYK_PICK: KnyhovykPick | null = null;
