import type { AlertLifecycle } from '@knyhovo/shared';

/**
 * AlertPolicy — the only thing the alert engine knows about an alert
 * (notifications-model-v2 §9.1).
 *
 * A policy fully describes *when to notify*. It carries no UX vocabulary: the
 * engine cannot tell an `any-drop` alert from a `my-price` one, and must not be
 * able to. Modes exist one layer up, in the resolver, and are applied exactly
 * once — at create/update time.
 *
 * That separation is the point: adding, renaming or removing a mode never
 * touches the engine, the dedup rules, the dispatcher or the email templates.
 */
export interface AlertPolicy {
  /** The price whose reaching is an event (kopiyky). */
  readonly threshold: number;
  /**
   * The price a further drop is measured against (kopiyky).
   * Null for static policies, and for follow-down policies that have not yet
   * observed a price (e.g. a book that was out of stock at creation time).
   */
  readonly baseline: number | null;
  /** What happens to threshold/baseline after a delivered notification. */
  readonly rearmPolicy: RearmPolicy;
  /** Which resolver rule produced the threshold — provenance, not behaviour. */
  readonly thresholdBasis: string | null;
  /** Human-readable proof shown in the UI and the email — provenance, not behaviour. */
  readonly thresholdProof: string | null;
  /** The only persisted state. */
  readonly lifecycle: AlertLifecycle;
}

export type RearmPolicy = 'follow-down' | 'static';

/**
 * Whether a drop is large enough to be worth an email.
 *
 * Both thresholds are configuration, never product doctrine (PRD §4): each is
 * disabled by a zero, and both must be exceeded for the drop to count. Callers
 * pass the values from the alert config so nothing about "how big is big" is
 * hardcoded in the engine.
 */
export interface SignificanceConfig {
  /** Minimum absolute drop in kopiyky. 0 disables the check. */
  readonly minDropAbs: number;
  /** Minimum drop as a percentage of the baseline. 0 disables the check. */
  readonly minDropPct: number;
}

/**
 * True when `price` is a significant drop below `baseline` under `config`.
 *
 * A null baseline means we have nothing to compare against yet — the drop counts,
 * because refusing to notify would strand an alert whose book was out of stock
 * when it was created.
 */
export function isSignificantDrop(
  price: number,
  baseline: number | null,
  config: SignificanceConfig,
): boolean {
  if (baseline === null) return true;
  const drop = baseline - price;
  if (drop <= 0) return false;
  if (config.minDropAbs > 0 && drop < config.minDropAbs) return false;
  if (config.minDropPct > 0 && drop * 100 < baseline * config.minDropPct) return false;
  return true;
}

/**
 * Apply the rearm policy after a notification was actually delivered.
 *
 * `follow-down` lowers both threshold and baseline onto the price we just wrote
 * about, so the next email needs a genuinely new drop — this is what makes
 * «Будь-яке зниження» keep working after the price has moved up and down again,
 * instead of being frozen at the price it was created at.
 *
 * `static` returns null: nothing to persist, the threshold stays where the user
 * or the resolver put it.
 */
export function applyRearm(
  policy: Pick<AlertPolicy, 'rearmPolicy'>,
  notifiedPriceAmount: number,
): { threshold: number; baseline: number } | null {
  if (policy.rearmPolicy !== 'follow-down') return null;
  return { threshold: notifiedPriceAmount, baseline: notifiedPriceAmount };
}
