'use client';

import { useId } from 'react';
import { Bell, Pencil } from 'lucide-react';
import { useAlertController } from '@/components/alerts/useAlertController';
import { AlertBell } from '@/components/alerts/AlertBell';
import { AlertConfig } from '@/components/alerts/AlertConfig';
import { AlertSurface } from '@/components/alerts/AlertSurface';
import { AlertNote } from '@/components/alerts/AlertNote';
import { AlertToast } from '@/components/alerts/AlertToast';
import type { AlertDto, MoneyDto } from '@/lib/api/types';

export interface WishlistAlertControlProps {
  /** The canonical book id; must already be in the wishlist before mutating. */
  readonly bookId: string;
  /** Alert state fetched server-side; null means no alert configured. */
  readonly alert: AlertDto | null;
  /** Best price today (kopiyky); drives below-current / any-drop targets. */
  readonly currentPrice: MoneyDto | null;
  /** The book title shown in the AlertConfig sub-heading. */
  readonly bookTitle: string;
  /** Display name of the best-price store (e.g. 'Yakaboo'). */
  readonly store?: string;
  /**
   * When true, renders a visible labelled action beside the bell — required on
   * mobile (WishlistCard) so the alert entry point is discoverable without a
   * hover/aria-only affordance. Desktop (WishlistRow) leaves this off.
   */
  readonly showLabel?: boolean;
}

/**
 * WishlistAlertControl — reusable bell + config-surface control for Wishlist surfaces.
 * Used by both WishlistRow (desktop actions cell) and WishlistCard (expanded body).
 *
 * Behaviour:
 * - Bell is disabled when state is 'unavailable'.
 * - When state is 'paused', clicking the bell resumes the alert directly (no form open).
 * - Otherwise, clicking the bell opens AlertConfig to create or edit.
 * - favourable-price intent is always disabled (typicalRangeMin=null) per W4b decision:
 *   no per-row price-history fetch on Wishlist; existing persisted favourable-price
 *   alerts remain fully manageable via their stored targetPrice.
 */
export function WishlistAlertControl({
  bookId,
  alert,
  currentPrice,
  bookTitle,
  store,
  showLabel = false,
}: WishlistAlertControlProps): React.JSX.Element {
  const ctrl = useAlertController({
    bookId,
    initialAlert: alert,
    currentPrice,
    typicalRangeMin: null,
  });

  const titleId = useId();

  // The bell and the labelled action share one handler: paused resumes directly,
  // every other state opens the config surface.
  const action = ctrl.uiState === 'paused' ? () => void ctrl.resume() : ctrl.openConfig;
  const labelText = ctrl.uiState === 'saved' ? 'Сповістити про ціну' : 'Змінити сповіщення';

  return (
    <span className={`al-anchor${showLabel ? ' al-anchor--labelled' : ''}`}>
      {showLabel &&
        (ctrl.uiState === 'unavailable' ? (
          <span className="al-target">Сповіщення недоступні</span>
        ) : (
          <button type="button" className="al-link al-link--sm" onClick={action}>
            {ctrl.uiState === 'saved' ? (
              <Bell size={13} aria-hidden />
            ) : (
              <Pencil size={13} aria-hidden />
            )}
            {labelText}
          </button>
        ))}

      <AlertBell state={ctrl.uiState} onClick={action} />

      <AlertSurface open={ctrl.open} onClose={ctrl.closeConfig} titleId={titleId}>
        <AlertConfig
          titleId={titleId}
          bookTitle={bookTitle}
          store={store}
          currentPrice={currentPrice}
          typicalRangeMin={null}
          editing={ctrl.alert !== null}
          paused={ctrl.uiState === 'paused'}
          initialIntent={ctrl.alert?.intent}
          busy={ctrl.busy}
          errorNote={
            ctrl.errorNote != null ? (
              <AlertNote kind="err">{ctrl.errorNote}</AlertNote>
            ) : undefined
          }
          targetPrice={ctrl.alert?.targetPrice}
          onSubmit={(intent, targetAmount) => void ctrl.submit(intent, targetAmount)}
          onCancel={ctrl.closeConfig}
          onRemove={() => void ctrl.remove()}
          onPause={() => void ctrl.pause()}
          onResume={() => void ctrl.resume()}
        />
      </AlertSurface>

      {ctrl.toast != null && (
        <AlertToast onDismiss={ctrl.dismissToast}>{ctrl.toast}</AlertToast>
      )}
    </span>
  );
}
