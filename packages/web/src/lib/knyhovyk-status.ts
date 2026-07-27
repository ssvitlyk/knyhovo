/**
 * Pure derivation of the wishlist v2.2 «Порада Книговика» status stamp.
 * Frozen 5-status-plus-none vocabulary (`incoming/CLAUDE.md`), distinct from
 * the 3-reason `BuyingReason` vocabulary that drives «Зараз вигідно купити» —
 * never merge the two. Priority (owner decision №1): goal → best → low90 →
 * deal → drop → none. All money amounts are integer kopiyky.
 */

export type KnyhovykStatusKind = 'goal' | 'best' | 'low90' | 'deal' | 'drop' | 'none';

export interface KnyhovykStatus {
  readonly kind: KnyhovykStatusKind;
  /** Stamp label, or `null` for `none` (no stamp rendered). */
  readonly label: string | null;
}

/**
 * The slice of a buying opportunity needed for the deal rule: whether the
 * curated pick is, among all of the user's current buying opportunities, the
 * one with the single largest real price drop.
 */
export interface KnyhovykOpportunitySignal {
  readonly bookId: string;
  readonly price: number;
  readonly prevPrice: number | null;
  readonly savingsAmount: number;
}

export interface DeriveKnyhovykStatusInput {
  /** The curated pick's canonical book id. */
  readonly bookId: string;
  /** Current price of the pick, or `null` when unavailable/unknown. */
  readonly currentAmount: number | null;
  /** Knyhovo's own last price-check snapshot before the current one. */
  readonly prevAmount: number | null;
  /** All-time lowest tracked price. */
  readonly allTimeMinAmount: number | null;
  /** Lowest tracked price within the last 90 days. */
  readonly min90Amount: number | null;
  /** The user's wishlist alert target price for the pick, if any. */
  readonly targetAmount: number | null;
  /** The user's current buying opportunities (any book, including the pick). */
  readonly opportunities: readonly KnyhovykOpportunitySignal[];
}

/** The alert slice the target-amount derivation needs (mirrors `AlertDto`). */
export interface KnyhovykAlertSlice {
  readonly state: 'armed' | 'paused' | 'reached' | 'unavailable';
  readonly threshold: { readonly amount: number };
}

/**
 * Extract the goal target amount from a wishlist alert. `reached` is a
 * read-time derived state meaning the target is already met — exactly the
 * case the `goal` stamp exists for — so it counts alongside `armed`.
 * `paused` (user muted) and `unavailable` (no offers) do not.
 */
export function alertTargetAmount(alert: KnyhovykAlertSlice | null | undefined): number | null {
  if (alert == null) return null;
  if (alert.state !== 'armed' && alert.state !== 'reached') return null;
  return alert.threshold.amount;
}

const STATUS_LABEL: Readonly<Record<Exclude<KnyhovykStatusKind, 'none'>, string>> = {
  goal: 'Ціль досягнута',
  best: 'Найкраща ціна',
  low90: 'Мінімум за 90 днів',
  // Owner decision №1: approved deviation from the frozen «Велика знижка» label.
  deal: 'Найбільша знижка',
  drop: 'Ціна впала',
};

/**
 * Find the bookId with the single largest real discount among opportunities
 * that have a valid `prevPrice > price`. Tie-break: `savingsAmount` desc, then
 * `bookId` asc. Returns `null` when no opportunity has a valid discount.
 */
function findDealWinner(opportunities: readonly KnyhovykOpportunitySignal[]): string | null {
  let winner: { bookId: string; discountPercent: number; savingsAmount: number } | null = null;

  for (const opp of opportunities) {
    if (opp.prevPrice == null || opp.prevPrice <= opp.price) continue;
    const discountPercent = (opp.prevPrice - opp.price) / opp.prevPrice;

    if (
      winner == null ||
      discountPercent > winner.discountPercent ||
      (discountPercent === winner.discountPercent &&
        (opp.savingsAmount > winner.savingsAmount ||
          (opp.savingsAmount === winner.savingsAmount && opp.bookId < winner.bookId)))
    ) {
      winner = { bookId: opp.bookId, discountPercent, savingsAmount: opp.savingsAmount };
    }
  }

  return winner?.bookId ?? null;
}

/** Derive the «Порада Книговика» status stamp per the frozen priority order. */
export function deriveKnyhovykStatus(input: DeriveKnyhovykStatusInput): KnyhovykStatus {
  const { bookId, currentAmount, prevAmount, allTimeMinAmount, min90Amount, targetAmount, opportunities } =
    input;

  if (currentAmount == null) return { kind: 'none', label: null };

  if (targetAmount != null && currentAmount <= targetAmount) {
    return { kind: 'goal', label: STATUS_LABEL.goal };
  }
  if (allTimeMinAmount != null && currentAmount <= allTimeMinAmount) {
    return { kind: 'best', label: STATUS_LABEL.best };
  }
  if (min90Amount != null && currentAmount <= min90Amount) {
    return { kind: 'low90', label: STATUS_LABEL.low90 };
  }
  if (findDealWinner(opportunities) === bookId) {
    return { kind: 'deal', label: STATUS_LABEL.deal };
  }
  if (prevAmount != null && currentAmount < prevAmount) {
    return { kind: 'drop', label: STATUS_LABEL.drop };
  }

  return { kind: 'none', label: null };
}
