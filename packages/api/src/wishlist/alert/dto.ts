import type { AlertStatus, AlertIntent } from '@knyhovo/shared';
import type { MoneyDto } from '../dto.js';

export type { AlertStatus, AlertIntent };

export interface AlertDto {
  readonly status: AlertStatus;     // DERIVED effective status
  readonly intent: AlertIntent;
  readonly targetPrice: MoneyDto;
  readonly pausedAt: string | null; // ISO 8601
}
