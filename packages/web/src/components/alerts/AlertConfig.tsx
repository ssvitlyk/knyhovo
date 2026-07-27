'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Info, X, Check } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { ALERT_MODE_COPY } from '@/lib/alerts';
import type { AlertDto, AlertMode, AlertModePreviewDto, MoneyDto } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';

export interface AlertConfigProps {
  /**
   * Id applied to the config title element, so the surrounding AlertSurface
   * dialog can reference it via `aria-labelledby` for an accessible name.
   */
  titleId?: string;
  /** The book title shown in the sub-heading. */
  bookTitle: string;
  /** The store name shown in the sub-heading (e.g. 'Yakaboo'). */
  store?: string;
  /** The current best price for the book (kopiyky); null when unavailable. */
  currentPrice: MoneyDto | null;
  /**
   * Per-mode alert preview, exactly 3 entries in fixed order
   * (any-drop, good-price, my-price), straight from the API
   * (`GET /books/:id/price-history`'s `alertPolicyPreview`). Rendered in the
   * order given — never re-sorted.
   */
  preview: readonly AlertModePreviewDto[];
  /** When true, renders the edit variant (Remove instead of Cancel). */
  editing?: boolean;
  /** When true, renders the paused-management surface instead of the mode form. */
  paused?: boolean;
  /** Initial selected mode. Defaults to the first available preview entry. */
  initialMode?: AlertMode;
  /** Initial my-price amount in kopiyky; pre-fills + pre-confirms the field when set (edit mode). */
  initialThresholdAmount?: number | null;
  /** When true, disables the primary submit action while a request is in flight. */
  busy?: boolean;
  /** Optional error note rendered at the top of the config body. */
  errorNote?: ReactNode;
  /** The currently stored alert, used for the paused-surface copy. */
  currentAlert?: AlertDto | null;
  /** Called with the resolved mode and, for `my-price`, the confirmed threshold (kopiyky). */
  onSubmit: (mode: AlertMode, threshold?: { amount: number; currency: 'UAH' }) => void;
  /** Called when the user dismisses the form without saving. */
  onCancel: () => void;
  /** Called when the user removes the alert. */
  onRemove?: () => void;
  /**
   * Called when the user pauses the alert. Kept for interface parity with the
   * controller (`useAlertController.pause`) — the new anatomy (PRD §6) moves
   * the pause affordance out of this dialog into the book card's own menu, so
   * this component no longer renders a control that invokes it.
   */
  onPause?: () => void;
  /** Called when the user resumes a paused alert. */
  onResume?: () => void;
}

/**
 * Pick the initial selected mode: the given mode if it is offered and
 * available, else the first available preview entry, else the preview's
 * first entry (so the group always has *some* selection, even if it renders
 * disabled — nothing here computes a threshold, only chooses which card
 * starts selected).
 */
function resolveInitialMode(
  preview: readonly AlertModePreviewDto[],
  initialMode?: AlertMode,
): AlertMode {
  if (initialMode != null) {
    const found = preview.find((p) => p.mode === initialMode);
    if (found != null && found.available) return initialMode;
  }
  const firstAvailable = preview.find((p) => p.available);
  return (firstAvailable ?? preview[0])?.mode ?? 'any-drop';
}

/**
 * AlertConfig — the mode-first alert configuration form body
 * (notifications-model-v2 §6-8). One question, three answers, one action.
 *
 * Props-driven only: every threshold, availability and proof string comes
 * from `preview` (itself sourced from the server's `alertPolicyPreview`). The
 * only numeric work this component does is converting the my-price text the
 * user themselves typed into integer kopiyky — that is not threshold
 * inference, it is reading what the user chose.
 *
 * Single vertical column of exactly 3 mode cards, in the order `preview`
 * gives them. `my-price` expands an inline confirm block inside its own card
 * when selected — never a second dialog or popover.
 *
 * Placed inside AlertSurface (centred dialog on desktop, bottom sheet on mobile).
 */
export function AlertConfig({
  titleId,
  bookTitle,
  store,
  currentPrice,
  preview,
  editing = false,
  paused = false,
  initialMode,
  initialThresholdAmount,
  busy = false,
  errorNote,
  currentAlert,
  onSubmit,
  onCancel,
  onRemove,
  onPause: _onPause,
  onResume,
}: AlertConfigProps): React.JSX.Element {
  const [selectedMode, setSelectedMode] = useState<AlertMode>(() =>
    resolveInitialMode(preview, initialMode),
  );

  // My-price local state — remembered across mode switches until the dialog
  // closes (component unmounts), never reset just by selecting another mode.
  const [myPriceStr, setMyPriceStr] = useState<string>(
    initialMode === 'my-price' && initialThresholdAmount != null
      ? String(Math.trunc(initialThresholdAmount / 100))
      : '',
  );
  const [myPriceConfirmed, setMyPriceConfirmed] = useState<number | null>(
    initialMode === 'my-price' ? (initialThresholdAmount ?? null) : null,
  );

  const myPriceInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<Partial<Record<AlertMode, HTMLDivElement | null>>>({});

  // Focus jumps into the my-price field automatically when it becomes selected.
  useEffect(() => {
    if (selectedMode === 'my-price') {
      myPriceInputRef.current?.focus();
    }
  }, [selectedMode]);

  const title = paused
    ? 'Сповіщення призупинено'
    : editing
      ? 'Сповіщення про ціну'
      : 'Коли повідомити про ціну?';

  const subParts: string[] = [`«${bookTitle}»`];
  if (currentPrice != null) subParts.push(`зараз ${formatMoney(currentPrice)}`);
  if (store != null) subParts.push(`у ${store}`);
  const subText = subParts.join(' · ');

  /**
   * The typed value parsed to kopiyky, or null when it is not a usable number.
   * This is the only numeric parsing this component does — converting a
   * decimal ₴ string the user themselves typed into an integer kopiyky
   * argument. It is not threshold arithmetic or alert-state inference.
   */
  const typedAmount: number | null = (() => {
    const parsed = parseFloat(myPriceStr.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100);
  })();

  const myPriceDirty = typedAmount !== myPriceConfirmed;

  function confirmMyPrice(): void {
    if (typedAmount === null || !myPriceDirty) return;
    setMyPriceConfirmed(typedAmount);
  }

  const selectedEntry = preview.find((p) => p.mode === selectedMode);
  const canSubmit =
    selectedEntry?.available === true &&
    (selectedMode !== 'my-price' || myPriceConfirmed != null);
  const submitDisabled = busy || !canSubmit;

  function handleSubmit(): void {
    if (!canSubmit) return;
    if (selectedMode === 'my-price') {
      if (myPriceConfirmed == null) return;
      onSubmit('my-price', { amount: myPriceConfirmed, currency: 'UAH' });
    } else {
      onSubmit(selectedMode);
    }
  }

  const availableModes = preview.filter((p) => p.available).map((p) => p.mode);

  function moveSelection(direction: 1 | -1): void {
    if (availableModes.length === 0) return;
    const idx = availableModes.indexOf(selectedMode);
    const from = idx === -1 ? 0 : idx;
    const next = availableModes[(from + direction + availableModes.length) % availableModes.length];
    setSelectedMode(next);
    cardRefs.current[next]?.focus();
  }

  function handleGroupKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  /** Enter in the my-price field confirms the field — never double-fires the group's Enter=save handling. */
  function handleMyPriceKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      confirmMyPrice();
    }
  }

  return (
    <div className="al-config">
      <div className="al-config__head">
        <div className="al-config__headmain">
          <span className="al-config__title" id={titleId}>
            {title}
          </span>
          <span className="al-config__sub">{subText}</span>
        </div>
        <button type="button" className="al-config__x" aria-label="Закрити" onClick={onCancel}>
          <X size={18} aria-hidden />
        </button>
      </div>

      {errorNote}

      {paused ? (
        /* ── Paused management surface ────────────────────────────────── */
        <>
          <div className="al-paused-note">
            <Info size={18} aria-hidden />
            <span>
              Книговик не стежить за ціною, доки сповіщення призупинене. Поновіть, щоб далі чекати
              на ціль {currentAlert != null && <b>{formatMoney(currentAlert.threshold)}</b>}.
            </span>
          </div>
          <div className="al-config__actions">
            <Button variant="ghost" onClick={onRemove}>
              Прибрати сповіщення
            </Button>
            <Button variant="primary" onClick={onResume}>
              Поновити сповіщення
            </Button>
          </div>
        </>
      ) : (
        /* ── Mode form ────────────────────────────────────────────────── */
        <>
          <div
            className="al-opts"
            role="radiogroup"
            aria-label="Коли повідомити"
            onKeyDown={handleGroupKeyDown}
          >
            {preview.map((entry) => {
              const copy = ALERT_MODE_COPY[entry.mode];
              const isSelected = selectedMode === entry.mode;
              const isDisabled = !entry.available;

              let description: string | null = null;
              if (isDisabled) {
                description = entry.reason;
              } else if (entry.mode === 'any-drop') {
                description = copy.description;
              } else if (entry.mode === 'good-price') {
                description = entry.proof;
              }

              // Only «Вигідна ціна» shows its threshold here — «Будь-яке
              // зниження» always resolves to the current price, which would
              // just restate the sub-heading; «Моя ціна» has no server
              // threshold to show until the user confirms their own number.
              const priceText =
                !isDisabled && entry.mode === 'good-price' && entry.threshold != null
                  ? `< ${formatMoney(entry.threshold)}`
                  : null;

              return (
                <div
                  key={entry.mode}
                  ref={(el) => {
                    cardRefs.current[entry.mode] = el;
                  }}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={isDisabled || undefined}
                  tabIndex={isDisabled ? -1 : isSelected ? 0 : -1}
                  className={[
                    'al-opt',
                    isSelected ? 'al-opt--on' : '',
                    isDisabled ? 'al-opt--disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={isDisabled ? undefined : () => setSelectedMode(entry.mode)}
                >
                  <span className="al-radio" aria-hidden />
                  <span className="al-opt__main">
                    <span className="al-opt__row">
                      <span className="al-opt__label">{copy.label}</span>
                      {priceText != null && <span className="al-opt__price">{priceText}</span>}
                    </span>
                    {description != null && <span className="al-opt__desc">{description}</span>}

                    {entry.mode === 'my-price' && isSelected && (
                      <div className="al-my">
                        <div className="al-my__row">
                          <span className="al-my__field">
                            <input
                              ref={myPriceInputRef}
                              id="al-my-price"
                              className="kn-input"
                              type="text"
                              inputMode="numeric"
                              aria-label="Моя ціна"
                              value={myPriceStr}
                              onChange={(e) => setMyPriceStr(e.target.value)}
                              onKeyDown={handleMyPriceKeyDown}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="500"
                            />
                            <span className="al-my__unit" aria-hidden>
                              ₴
                            </span>
                          </span>
                          <Button
                            variant="secondary"
                            disabled={typedAmount === null || !myPriceDirty}
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmMyPrice();
                            }}
                          >
                            Підтвердити
                          </Button>
                        </div>
                        {myPriceConfirmed != null && !myPriceDirty && (
                          <span className="al-my__hint">
                            <Check size={13} aria-hidden />
                            Поріг — нижче{' '}
                            {formatMoney({ amount: myPriceConfirmed, currency: 'UAH' })}
                          </span>
                        )}
                      </div>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="al-config__footer">
            <span className="al-config__cadence">Перевіряємо ціни щоранку</span>
            <div className="al-config__actions">
              {!editing && (
                <Button variant="ghost" onClick={onCancel}>
                  Скасувати
                </Button>
              )}
              <Button variant="primary" disabled={submitDisabled} onClick={handleSubmit}>
                Зберегти
              </Button>
            </div>
            {editing && (
              <button type="button" className="al-config__remove" onClick={onRemove}>
                Прибрати сповіщення
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
