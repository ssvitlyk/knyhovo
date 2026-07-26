import type { AlertIntent, AlertLifecycle, AlertState } from '@knyhovo/shared';
import type { MoneyDto } from '../dto.js';

export type { AlertIntent, AlertLifecycle, AlertState };

export interface AlertDto {
  /** Effective state shown to the user — derived from facts, never from a price comparison. */
  readonly state: AlertState;
  readonly intent: AlertIntent;
  readonly targetPrice: MoneyDto;
  readonly pausedAt: string | null; // ISO 8601
  /** When we last emailed about the current threshold; null = never. */
  readonly notifiedAt: string | null; // ISO 8601
}
