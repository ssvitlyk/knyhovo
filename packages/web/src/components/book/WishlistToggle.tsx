'use client';

import { useEffect, useId, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Heart,
  Bell,
  BellDot,
  CheckCircle2,
  RefreshCw,
  Pencil,
  Loader2,
  CirclePlus,
  CircleMinus,
  TriangleAlert,
} from 'lucide-react';
import { addToWishlist, removeFromWishlist, WishlistError } from '@/lib/api/wishlist';
import { getPriceHistory } from '@/lib/api/priceHistory';
import { useAlertController } from '@/components/alerts/useAlertController';
import { AlertConfig } from '@/components/alerts/AlertConfig';
import { AlertSurface } from '@/components/alerts/AlertSurface';
import { AlertNote } from '@/components/alerts/AlertNote';
import { AlertToast } from '@/components/alerts/AlertToast';
import { formatMoney } from '@/lib/format';
import type { AlertDto, AlertModePreviewDto, MoneyDto } from '@/lib/api/types';

export interface WishlistToggleProps {
  readonly bookId: string;
  readonly initialInWishlist: boolean;
  readonly initialAlert: AlertDto | null;
  /** Best price today; drives the sub-heading and the row's target diff copy. */
  readonly currentPrice: MoneyDto | null;
  readonly bookTitle: string;
  /** Display name of the best-price store (e.g. 'Yakaboo'). */
  readonly store?: string;
}

/** A recoverable row-level failure: the message plus the action «Ще раз» repeats. */
interface RowError {
  readonly text: string;
  readonly retry: () => void;
}

/**
 * WishlistToggle — the «Особиста полиця» group (frozen 2026-07-26): one `.wsh`
 * group of two 52px rows under the primary CTA — wishlist first, price alert
 * second. The alert row never goes `disabled`: while the book is not saved it
 * only *sleeps*, and tapping it adds the book and opens the target editor.
 * Alert mutations stay in useAlertController; failures surface locally as a
 * third `.wsh-err` segment so the panel itself never breaks.
 *
 * notifications-model-v2: this component never computes a threshold or infers
 * alert state — it reads `state`/`mode`/`threshold`/`thresholdProof` verbatim
 * from the server, and forwards the price-history `alertPolicyPreview` to
 * AlertConfig unmodified.
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
  const [rowError, setRowError] = useState<RowError | null>(null);
  const [wishlistToast, setWishlistToast] = useState<string | null>(null);
  const titleId = useId();

  // Per-mode alert preview backing AlertConfig — lazily fetched on first open.
  // Exactly 3 entries (any-drop, good-price, my-price) once loaded; empty
  // until then (AlertConfig renders nothing until the fetch resolves, which is
  // fast enough that the dialog never has to show its own loading state here).
  const [preview, setPreview] = useState<readonly AlertModePreviewDto[]>([]);
  const historyFetchedRef = useRef(false);

  const ctrl = useAlertController({
    bookId,
    initialAlert,
    currentPrice,
  });

  /**
   * Add / remove the book. Returns whether the mutation succeeded so the alert
   * row can chain `openConfig()` onto a successful add.
   */
  async function runWishlist(next: boolean): Promise<boolean> {
    if (pending) return false;
    setAuthNote(false);
    setRowError(null);
    setPending(true);
    setSaved(next); // optimistic

    try {
      if (next) {
        await addToWishlist(bookId);
      } else {
        await removeFromWishlist(bookId);
      }
      setWishlistToast(next ? 'Додано до бажанок' : 'Прибрано з бажанок');
      return true;
    } catch (error) {
      setSaved(!next); // revert on error
      if (error instanceof WishlistError && error.status === 401) {
        setAuthNote(true);
      } else {
        setRowError({
          text: next ? 'Не вдалося додати до бажанок.' : 'Не вдалося прибрати з бажанок.',
          retry: () => void runWishlist(next),
        });
      }
      return false;
    } finally {
      setPending(false);
    }
  }

  function openConfig(): void {
    // Lazily fetch price history the first time the config opens — the
    // dialog needs its alertPolicyPreview (fixed window, independent of chart
    // period — the '90d' argument here only drives what would otherwise be
    // rendered as a chart, not the preview itself).
    if (!historyFetchedRef.current) {
      historyFetchedRef.current = true;
      getPriceHistory(bookId, '90d')
        .then((data) => {
          setPreview(data.alertPolicyPreview);
        })
        .catch(() => {
          // Swallow — AlertConfig simply has nothing to render yet; the user
          // can retry by reopening.
        });
    }
    setRowError(null);
    ctrl.openConfig();
  }

  /** Sleeping alert row: add to the wishlist, then open the target editor. */
  async function wakeAlertRow(): Promise<void> {
    const ok = await runWishlist(true);
    if (ok) openConfig();
  }

  function handleResume(): void {
    setRowError(null);
    void ctrl.resume();
  }

  // ctrl.errorNote is rendered inside AlertConfig only. A resume started from the
  // row happens with the config closed, so an error appearing in that situation
  // can only come from this row — mirror it into the local `.wsh-err` segment.
  const seenErrorNoteRef = useRef<string | null>(ctrl.errorNote);
  useEffect(() => {
    const previous = seenErrorNoteRef.current;
    seenErrorNoteRef.current = ctrl.errorNote;
    if (!ctrl.open && ctrl.errorNote != null && ctrl.errorNote !== previous) {
      setRowError({ text: 'Не вдалося поновити сповіщення.', retry: handleResume });
    }
    // handleResume is re-created every render but always closes over the same
    // controller action — deliberately excluded from the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl.errorNote, ctrl.open]);

  const alertBusy = ctrl.busy || pending;
  const uiState = ctrl.uiState;
  const spinner = <Loader2 className="wsh-spin" aria-hidden />;

  /** Row 2 label / sub / tail / action per the 9 frozen states. */
  function renderAlertRow(): React.JSX.Element {
    if (!saved) {
      return (
        <button
          type="button"
          className="wsh-row wsh-row--asleep"
          aria-busy={alertBusy ? 'true' : undefined}
          onClick={() => void wakeAlertRow()}
        >
          <span className="wsh-row__ico">
            <Bell size={18} aria-hidden />
          </span>
          <span className="wsh-row__main">
            <span className="wsh-row__l">Сповістити про зниження ціни</span>
            <span className="wsh-row__s">Спершу додайте до бажанок</span>
          </span>
          {alertBusy && (
            <span className="wsh-row__tr" aria-hidden>
              {spinner}
            </span>
          )}
        </button>
      );
    }

    if (uiState === 'unavailable') {
      // The single state without an alert action — informational, not a button.
      return (
        <div className="wsh-info">
          <Bell size={16} aria-hidden />
          Сповістимо, коли книга знову з&rsquo;явиться
        </div>
      );
    }

    // Editing affordance: the pencil chip alone did not say what tapping the row
    // does, so >=768px spells it out (same text-tail treatment the wishlist row
    // uses). Still one hit area, still one focus stop — the tail is decorative and
    // the row carries an explicit accessible name instead.
    const editTail = (
      <>
        <span className="wsh-row__ed">Редагувати</span>
        <span className="wsh-chip">
          <Pencil size={15} />
        </span>
      </>
    );

    let mods = '';
    let icon: React.JSX.Element;
    let label: string;
    let sub: React.ReactNode = null;
    let subPlain: string | null = null;
    let tail: React.ReactNode;
    let onClick: () => void;
    let editable = false;

    switch (uiState) {
      case 'saved':
        icon = <Bell size={18} aria-hidden />;
        label = 'Сповістити про зниження ціни';
        tail = <CirclePlus aria-hidden />;
        onClick = openConfig;
        break;

      case 'armed':
        icon = <BellDot size={18} aria-hidden />;
        label = 'Сповіщення про зниження увімкнено';
        subPlain =
          ctrl.alert?.mode === 'any-drop'
            ? 'Будь-яке зниження ціни'
            : ctrl.alert != null
              ? `Ціль — нижче ${formatMoney(ctrl.alert.threshold)}`
              : null;
        sub = subPlain;
        tail = editTail;
        editable = true;
        onClick = openConfig;
        break;

      case 'reached':
        mods = 'wsh-row--ok';
        icon = <CheckCircle2 size={18} aria-hidden />;
        label = 'Ціль досягнута';
        // Without a current price there is no honest diff to state — the label
        // alone carries the state (colour is never the only cue).
        sub =
          ctrl.alert != null && currentPrice != null ? (
            <>
              {formatMoney(currentPrice)} — на{' '}
              <b>
                {formatMoney({
                  amount: ctrl.alert.threshold.amount - currentPrice.amount,
                  currency: currentPrice.currency,
                })}{' '}
                нижче
              </b>{' '}
              вашої цілі {formatMoney(ctrl.alert.threshold)}
            </>
          ) : null;
        subPlain =
          ctrl.alert != null && currentPrice != null
            ? `${formatMoney(currentPrice)} — нижче вашої цілі ${formatMoney(ctrl.alert.threshold)}`
            : null;
        tail = editTail;
        editable = true;
        onClick = openConfig;
        break;

      case 'paused':
        icon = <RefreshCw size={18} aria-hidden />;
        label = 'Поновити сповіщення';
        sub = 'Сповіщення призупинено';
        tail = <CirclePlus aria-hidden />;
        onClick = handleResume;
        break;
    }

    return (
      <button
        type="button"
        className={`wsh-row ${mods}`.trimEnd()}
        aria-busy={alertBusy ? 'true' : undefined}
        aria-label={
          editable
            ? [label, subPlain, 'Редагувати ціль'].filter(Boolean).join('. ')
            : undefined
        }
        onClick={onClick}
      >
        <span className="wsh-row__ico">{icon}</span>
        <span className="wsh-row__main">
          <span className="wsh-row__l">{label}</span>
          {sub != null && <span className="wsh-row__s">{sub}</span>}
        </span>
        <span className="wsh-row__tr" aria-hidden>
          {alertBusy ? spinner : tail}
        </span>
      </button>
    );
  }

  return (
    <div className="wl-toggle">
      <div className="wsh">
        {/* Row 1 — wishlist. Always a button; the tail glyph is decorative. */}
        <button
          type="button"
          className={saved ? 'wsh-row wsh-row--st' : 'wsh-row'}
          aria-pressed={saved}
          aria-busy={pending ? 'true' : undefined}
          onClick={() => void runWishlist(!saved)}
        >
          <span className="wsh-row__ico">
            <Heart size={18} aria-hidden />
          </span>
          <span className="wsh-row__main">
            <span className="wsh-row__l">{saved ? 'У бажанках' : 'Додати до бажанок'}</span>
          </span>
          <span className="wsh-row__tr" aria-hidden>
            {pending ? (
              spinner
            ) : saved ? (
              // ≥768px shows the text tail, below it the glyph (CSS swap).
              <>
                <span className="wsh-row__rm">Прибрати з бажанок</span>
                <CircleMinus className="wsh-row__mn" />
              </>
            ) : (
              <CirclePlus />
            )}
          </span>
        </button>

        {/* Row 2 — price alert (or the unavailable info row). */}
        {renderAlertRow()}

        {/* Row 3 — local, recoverable error segment. */}
        {rowError != null && (
          <div className="wsh-err" role="alert">
            <TriangleAlert aria-hidden />
            <span className="wsh-err__b">{rowError.text}</span>
            <button
              type="button"
              className="kn-btn kn-btn--secondary kn-btn--sm"
              onClick={rowError.retry}
            >
              Ще раз
            </button>
          </div>
        )}
      </div>

      {authNote && (
        <Link className="wl-toggle__note" href={`/login?returnTo=${encodeURIComponent(`/books/${bookId}`)}`}>
          Увійдіть, щоб додавати до бажанок
        </Link>
      )}

      <AlertSurface open={ctrl.open} onClose={ctrl.closeConfig} titleId={titleId}>
        <AlertConfig
          titleId={titleId}
          bookTitle={bookTitle}
          store={store}
          currentPrice={currentPrice}
          preview={preview}
          initialMode={ctrl.alert?.mode}
          initialThresholdAmount={
            ctrl.alert?.mode === 'my-price' ? ctrl.alert.threshold.amount : null
          }
          editing={ctrl.alert !== null}
          paused={uiState === 'paused'}
          busy={ctrl.busy}
          errorNote={
            ctrl.errorNote != null ? <AlertNote kind="err">{ctrl.errorNote}</AlertNote> : undefined
          }
          currentAlert={ctrl.alert}
          onSubmit={(mode, threshold) => void ctrl.submit(mode, threshold)}
          onCancel={ctrl.closeConfig}
          onRemove={() => void ctrl.remove()}
          onPause={() => void ctrl.pause()}
          onResume={() => void ctrl.resume()}
        />
      </AlertSurface>

      {(ctrl.toast ?? wishlistToast) != null && (
        <AlertToast
          onDismiss={() => {
            ctrl.dismissToast();
            setWishlistToast(null);
          }}
        >
          {ctrl.toast ?? wishlistToast}
        </AlertToast>
      )}
    </div>
  );
}
