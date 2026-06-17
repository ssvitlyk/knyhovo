import type { AlertUiState } from '@/lib/alerts';
import type { AlertIntent, MoneyDto } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';

export interface AlertTargetProps {
  /** The current alert UI state. When 'saved', renders nothing. */
  state: AlertUiState;
  /** The intent the alert was configured with. */
  intent: AlertIntent;
  /** The stored target price (kopiyky). */
  targetPrice: MoneyDto;
  /** The current best price for the book (kopiyky). Used in the triggered copy. */
  currentPrice?: MoneyDto | null;
}

/**
 * AlertTarget — the target-price reason line shown below the status chip.
 * Renders the appropriate Ukrainian copy for each alert state.
 * Returns `null` when `state === 'saved'` (no alert configured).
 * Purely presentational — no event handlers, no client-side state.
 */
export function AlertTarget({
  state,
  intent,
  targetPrice,
  currentPrice,
}: AlertTargetProps): React.JSX.Element | null {
  switch (state) {
    case 'saved':
      return null;

    case 'watch':
      if (intent === 'any-drop') {
        return (
          <span className="al-target">
            Книговик напише, щойно ціна впаде.
          </span>
        );
      }
      return (
        <span className="al-target">
          Книговик напише, коли ціна стане{' '}
          <b>нижче {formatMoney(targetPrice)}</b>.
        </span>
      );

    case 'triggered':
      if (currentPrice != null) {
        return (
          <span className="al-target al-target--green">
            Ціна впала до <b>{formatMoney(currentPrice)}</b> — нижче за вашу
            ціль <b>{formatMoney(targetPrice)}</b>.
          </span>
        );
      }
      return (
        <span className="al-target al-target--green">
          Ціль <b>{formatMoney(targetPrice)}</b> досягнута.
        </span>
      );

    case 'paused':
      return (
        <span className="al-target">
          Поновіть, щоб Книговик стежив далі.
        </span>
      );

    case 'unavailable':
      return (
        <span className="al-target">
          Сповістимо, щойно книга з&apos;явиться.
        </span>
      );
  }
}
