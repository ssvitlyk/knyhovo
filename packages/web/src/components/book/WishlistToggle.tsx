'use client';

import { useState, useRef } from 'react';
import { Bookmark, BookmarkCheck, Bell, Pencil } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { addToWishlist, removeFromWishlist, WishlistError } from '@/lib/api/wishlist';
import { getPriceHistory } from '@/lib/api/priceHistory';
import { useAlertController } from '@/components/alerts/useAlertController';
import { AlertChip } from '@/components/alerts/AlertChip';
import { AlertTarget } from '@/components/alerts/AlertTarget';
import { AlertConfig } from '@/components/alerts/AlertConfig';
import { AlertSurface } from '@/components/alerts/AlertSurface';
import { AlertNote } from '@/components/alerts/AlertNote';
import { AlertToast } from '@/components/alerts/AlertToast';
import type { AlertDto, MoneyDto } from '@/lib/api/types';

export interface WishlistToggleProps {
  readonly bookId: string;
  readonly initialInWishlist: boolean;
  readonly initialAlert: AlertDto | null;
  /** Best price today; drives below-current / any-drop targets and the sub-heading. */
  readonly currentPrice: MoneyDto | null;
  readonly bookTitle: string;
  /** Display name of the best-price store (e.g. 'Yakaboo'). */
  readonly store?: string;
}

/**
 * WishlistToggle — adds/removes the current book from the wishlist (optimistic,
 * 401 inline note) and renders the alert affordance below when the book is saved.
 * Alert state is managed by useAlertController; typicalRangeMin for the
 * favourable-price intent is lazily fetched on first config open.
 */
export function WishlistToggle({
  bookId,
  initialInWishlist,
  initialAlert,
  currentPrice,
  bookTitle,
  store,
}: WishlistToggleProps): React.JSX.Element {
  const [saved, setSaved] = useState(initialInWishlist);
  const [pending, setPending] = useState(false);
  const [authNote, setAuthNote] = useState(false);

  // typicalRangeMin for the favourable-price intent — lazily fetched on first open.
  const [typicalRangeMin, setTypicalRangeMin] = useState<number | null>(null);
  const historyFetchedRef = useRef(false);

  const ctrl = useAlertController({
    bookId,
    initialAlert,
    currentPrice,
    typicalRangeMin,
  });

  async function handleToggle(): Promise<void> {
    if (pending) return;
    setAuthNote(false);
    setPending(true);

    const nextSaved = !saved;
    setSaved(nextSaved); // optimistic

    try {
      if (nextSaved) {
        await addToWishlist(bookId);
      } else {
        await removeFromWishlist(bookId);
      }
    } catch (error) {
      setSaved(!nextSaved); // revert on error
      if (error instanceof WishlistError && error.status === 401) {
        setAuthNote(true);
      }
    } finally {
      setPending(false);
    }
  }

  function handleOpenConfig(): void {
    // Lazily fetch price history the first time the config opens for favourable-price.
    if (!historyFetchedRef.current) {
      historyFetchedRef.current = true;
      getPriceHistory(bookId, '90d')
        .then((data) => {
          setTypicalRangeMin(data.typicalRange?.min ?? null);
        })
        .catch(() => {
          // Swallow — favourable-price intent stays disabled (typicalRangeMin stays null).
        });
    }
    ctrl.openConfig();
  }

  return (
    <div className="wl-toggle">
      <Button
        variant="secondary"
        disabled={pending}
        iconLeft={saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
        onClick={() => void handleToggle()}
        style={{ width: '100%' }}
      >
        {saved ? 'У вішлисті' : 'До вішлиста'}
      </Button>

      {authNote && (
        <p className="wl-toggle__note">Увійдіть, щоб зберігати книги</p>
      )}

      {saved && (
        <span className="al-anchor">
          {ctrl.uiState === 'saved' && (
            <button type="button" className="al-link" onClick={handleOpenConfig}>
              <Bell size={15} aria-hidden />
              Сповістити про зниження ціни
            </button>
          )}

          {ctrl.uiState === 'watch' && ctrl.alert !== null && (
            <>
              <AlertChip state="watch" />
              <AlertTarget
                state="watch"
                intent={ctrl.alert.intent}
                targetPrice={ctrl.alert.targetPrice}
                currentPrice={currentPrice}
              />
              <button type="button" className="al-link" onClick={handleOpenConfig}>
                <Pencil size={13} aria-hidden />
                Змінити
              </button>
            </>
          )}

          {ctrl.uiState === 'triggered' && ctrl.alert !== null && (
            <>
              <AlertChip state="triggered" />
              <AlertTarget
                state="triggered"
                intent={ctrl.alert.intent}
                targetPrice={ctrl.alert.targetPrice}
                currentPrice={currentPrice}
              />
              <button type="button" className="al-link" onClick={handleOpenConfig}>
                <Pencil size={13} aria-hidden />
                Змінити
              </button>
            </>
          )}

          {ctrl.uiState === 'paused' && (
            <>
              <AlertChip state="paused" />
              <span className="al-muted">Стеження призупинене.</span>
              <button type="button" className="al-link" onClick={() => void ctrl.resume()}>
                Поновити сповіщення
              </button>
            </>
          )}

          {ctrl.uiState === 'unavailable' && ctrl.alert !== null && (
            <>
              <AlertChip state="unavailable" />
              <AlertTarget
                state="unavailable"
                intent={ctrl.alert.intent}
                targetPrice={ctrl.alert.targetPrice}
                currentPrice={currentPrice}
              />
            </>
          )}

          <AlertSurface open={ctrl.open} onClose={ctrl.closeConfig}>
            <AlertConfig
              bookTitle={bookTitle}
              store={store}
              currentPrice={currentPrice}
              typicalRangeMin={typicalRangeMin}
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
        </span>
      )}

      {ctrl.toast != null && (
        <AlertToast onDismiss={ctrl.dismissToast}>{ctrl.toast}</AlertToast>
      )}
    </div>
  );
}
