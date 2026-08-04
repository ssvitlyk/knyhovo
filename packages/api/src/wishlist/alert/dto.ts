import type { AlertLifecycle, AlertMode, AlertState } from '@knyhovo/shared';
import type { MoneyDto } from '../dto.js';

export type { AlertLifecycle, AlertMode, AlertState };

export interface AlertDto {
  /** Effective state shown to the user — derived from facts, never from a price comparison. */
  readonly state: AlertState;
  /** The mode the user picked — a label, never behaviour (§9.1). */
  readonly mode: AlertMode;
  /** The policy threshold the server resolved and froze. */
  readonly threshold: MoneyDto;
  /** The price a further drop is measured against; null for static policies. */
  readonly baseline: MoneyDto | null;
  /** One-line human proof of where the threshold came from. */
  readonly thresholdProof: string | null;
  readonly pausedAt: string | null; // ISO 8601
  /** When we last emailed about the current threshold; null = never. */
  readonly notifiedAt: string | null; // ISO 8601
}
