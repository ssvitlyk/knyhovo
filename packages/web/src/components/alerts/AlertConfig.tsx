'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Clock, BellOff, Info, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { ALERT_INTENTS, resolveTargetAmount } from '@/lib/alerts';
import type { AlertIntent, MoneyDto } from '@/lib/api/types';
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
   * The typical-range minimum from Price History (kopiyky).
   * Null disables the 'favourable-price' intent option.
   */
  typicalRangeMin: number | null;
  /** When true, renders the edit variant (Save/Remove instead of Enable/Cancel). */
  editing?: boolean;
  /** When true, renders the paused-management surface instead of the intent form. */
  paused?: boolean;
  /** Initial selected intent. Defaults to 'below-current'. */
  initialIntent?: AlertIntent;
  /** Initial custom amount in kopiyky; also opens the custom disclosure when set. */
  initialCustomAmount?: number | null;
  /** When true, disables the primary submit action while a request is in flight. */
  busy?: boolean;
  /** Optional error note rendered at the top of the config body. */
  errorNote?: ReactNode;
  /**
   * The stored target price used by the paused surface copy.
   * Required for a meaningful paused surface; treated as null otherwise.
   */
  targetPrice?: MoneyDto | null;
  /** Called with the resolved intent and target amount (kopiyky) on primary action. */
  onSubmit: (intent: AlertIntent, targetAmount: number) => void;
  /** Called when the user dismisses the form without saving. */
  onCancel: () => void;
  /** Called when the user removes the alert. */
  onRemove?: () => void;
  /** Called when the user pauses the alert (edit mode only). */
  onPause?: () => void;
  /** Called when the user resumes a paused alert. */
  onResume?: () => void;
}

/**
 * AlertConfig — the intent-first alert configuration form body.
 * Stateful: owns the selected intent, custom-price disclosure state and
 * custom amount field. Renders either the intent radiogroup form (create/edit)
 * or the paused-management surface depending on the `paused` prop.
 *
 * Placed inside AlertSurface (popover or bottom sheet).
 */
export function AlertConfig({
  titleId,
  bookTitle,
  store,
  currentPrice,
  typicalRangeMin,
  editing = false,
  paused = false,
  initialIntent,
  initialCustomAmount,
  busy = false,
  errorNote,
  targetPrice,
  onSubmit,
  onCancel,
  onRemove,
  onPause,
  onResume,
}: AlertConfigProps): React.JSX.Element {
  const [selectedIntent, setSelectedIntent] = useState<AlertIntent>(
    initialIntent ?? 'below-current',
  );
  const [customOpen, setCustomOpen] = useState<boolean>(!!initialCustomAmount);
  // Custom amount stored as a display string (₴); converted to kopiyky on submit.
  const [customAmountStr, setCustomAmountStr] = useState<string>(
    initialCustomAmount != null ? String(Math.trunc(initialCustomAmount / 100)) : '',
  );

  const title = paused
    ? 'Сповіщення призупинено'
    : editing
      ? 'Сповіщення про ціну'
      : 'Коли повідомити про ціну?';

  const subParts: string[] = [`«${bookTitle}»`];
  if (currentPrice != null) {
    subParts.push(`зараз ${formatMoney(currentPrice)}`);
  }
  if (store != null) {
    subParts.push(`у ${store}`);
  }
  const subText = subParts.join(' · ');

  /** Resolve current form custom amount to kopiyky or null. */
  const customAmountKopiyky: number | null = (() => {
    const parsed = parseFloat(customAmountStr.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100);
  })();

  /** The intent that drives resolveTargetAmount — custom-price when the disclosure is open. */
  const effectiveIntent: AlertIntent = customOpen ? 'custom-price' : selectedIntent;

  const resolvedAmount = resolveTargetAmount(effectiveIntent, {
    currentAmount: currentPrice?.amount ?? null,
    typicalRangeMin,
    customAmount: customAmountKopiyky,
  });

  const submitDisabled = busy || resolvedAmount === null;

  function handleSubmit(): void {
    if (resolvedAmount === null) return;
    onSubmit(effectiveIntent, resolvedAmount);
  }

  function handleIntentClick(key: AlertIntent): void {
    setSelectedIntent(key);
    setCustomOpen(false);
  }

  return (
    <div className="al-config">
      {/* Head */}
      <div className="al-config__head">
        <span className="al-config__title" id={titleId}>{title}</span>
        <span className="al-config__sub">{subText}</span>
      </div>

      {/* Optional error note */}
      {errorNote}

      {paused ? (
        /* ── Paused management surface ────────────────────────────────── */
        <>
          <div className="al-paused-note">
            <Info size={18} aria-hidden />
            <span>
              Книговик не стежить за ціною, доки сповіщення призупинене. Поновіть, щоб далі чекати
              на ціль{' '}
              {targetPrice != null && (
                <b>{formatMoney(targetPrice)}</b>
              )}
              .
            </span>
          </div>
          <div className="al-config__actions">
            <Button variant="ghost" onClick={onRemove}>
              Прибрати
            </Button>
            <span className="al-grow">
              <Button variant="primary" onClick={onResume}>
                Поновити сповіщення
              </Button>
            </span>
          </div>
        </>
      ) : (
        /* ── Intent form ──────────────────────────────────────────────── */
        <>
          {/* Intent radiogroup */}
          <div className="al-opts" role="radiogroup" aria-label="Коли повідомити">
            {ALERT_INTENTS.map((intentDef) => {
              const isDisabled = intentDef.needsHistory && typicalRangeMin === null;
              const isSelected = !customOpen && selectedIntent === intentDef.key;

              let priceText: string = '';
              if (!isDisabled) {
                if (intentDef.key === 'any-drop') {
                  priceText = '';
                } else if (intentDef.key === 'below-current') {
                  priceText = currentPrice != null ? formatMoney(currentPrice) : '';
                } else if (intentDef.key === 'favourable-price') {
                  priceText =
                    typicalRangeMin != null
                      ? formatMoney({ amount: typicalRangeMin, currency: 'UAH' })
                      : '';
                }
              }

              const optClassName = [
                'al-opt',
                isSelected ? 'al-opt--on' : '',
                isDisabled ? 'al-opt--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={intentDef.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={isDisabled || undefined}
                  className={optClassName}
                  disabled={isDisabled}
                  onClick={isDisabled ? undefined : () => handleIntentClick(intentDef.key)}
                >
                  <span className="al-radio" aria-hidden />
                  <span className="al-opt__main">
                    <span className="al-opt__label">{intentDef.label}</span>
                    <span className="al-opt__desc">
                      {isDisabled ? 'Збираємо історію цін…' : intentDef.desc}
                    </span>
                  </span>
                  {priceText !== '' && !isDisabled && (
                    <span className="al-opt__price">{priceText}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom-price disclosure */}
          {customOpen ? (
            <div className="al-custom">
              <div className="al-custom__row">
                <input
                  className="kn-input"
                  type="text"
                  inputMode="numeric"
                  aria-label="Власна ціна"
                  value={customAmountStr}
                  onChange={(e) => setCustomAmountStr(e.target.value)}
                  placeholder="230"
                />
                <span className="al-custom__unit">₴</span>
                <button
                  type="button"
                  className="al-link al-link--sm al-custom__cancel"
                  aria-label="Скасувати власну ціну"
                  onClick={() => {
                    setCustomOpen(false);
                    setCustomAmountStr('');
                  }}
                >
                  <X size={13} aria-hidden />
                  Скасувати
                </button>
              </div>
              <span className="al-opt__desc">
                Книговик напише, коли ціна стане нижчою за вашу.
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="al-link al-link--sm"
              onClick={() => {
                setCustomOpen(true);
              }}
            >
              <Pencil size={13} aria-hidden />
              Вказати свою ціну
            </button>
          )}

          {/* Pause affordance — edit mode only */}
          {editing && onPause != null && (
            <div className="al-manage">
              <button type="button" className="al-manage__btn" onClick={onPause}>
                <BellOff size={15} aria-hidden />
                Призупинити сповіщення
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="al-config__foot">
            <Clock size={14} aria-hidden />
            <span>
              Knyhovo перевіряє ціни щодня о 08:00 — щойно ціль досягнута, Книговик одразу напише
              на пошту.
            </span>
          </div>

          {/* Actions */}
          <div className="al-config__actions">
            {editing ? (
              <>
                <Button variant="ghost" onClick={onRemove}>
                  Прибрати
                </Button>
                <span className="al-grow">
                  <Button variant="primary" disabled={submitDisabled} onClick={handleSubmit}>
                    Зберегти
                  </Button>
                </span>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={onCancel}>
                  Скасувати
                </Button>
                <span className="al-grow">
                  <Button variant="primary" disabled={submitDisabled} onClick={handleSubmit}>
                    Увімкнути сповіщення
                  </Button>
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
