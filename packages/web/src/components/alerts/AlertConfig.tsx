'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Clock, BellOff, Info, X, Check } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { ALERT_INTENTS, resolveTargetAmount } from '@/lib/alerts';
import type { FavourableState } from '@/lib/alerts';
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
   * The favourable-price threshold (kopiyky), already validated against the
   * recorded-history gate by `resolveFavourableTarget`. Null → the mode renders
   * as «Визначаємо вигідну ціну» and cannot be selected. It is never the current
   * price restated.
   */
  favourablePrice: number | null;
  /** Why the favourable mode has no price yet; drives its helper copy. */
  favourableState?: FavourableState;
  /** When true, renders the edit variant (Remove instead of Cancel). */
  editing?: boolean;
  /** When true, renders the paused-management surface instead of the intent form. */
  paused?: boolean;
  /** Initial selected intent. Defaults to 'below-current'. */
  initialIntent?: AlertIntent;
  /** Initial custom amount in kopiyky; pre-confirms the custom-price field when set. */
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
 *
 * Desktop-first: the four modes sit in a 2×2 grid inside a centred dialog, so the
 * whole decision is one glance instead of a tall single column. `custom-price` is
 * a real fourth mode — selecting it expands an inline price field + «Підтвердити»
 * right under the grid; once confirmed it behaves exactly like the other three.
 * No secondary dialog, no text-link disclosure.
 *
 * Stateful: owns the selected intent and the custom-price field. Placed inside
 * AlertSurface (centred dialog on desktop, bottom sheet on mobile).
 */
export function AlertConfig({
  titleId,
  bookTitle,
  store,
  currentPrice,
  favourablePrice,
  favourableState = 'collecting',
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
  // Custom amount as a display string (₴); converted to kopiyky on confirm.
  const [customAmountStr, setCustomAmountStr] = useState<string>(
    initialCustomAmount != null ? String(Math.trunc(initialCustomAmount / 100)) : '',
  );
  /** Confirmed custom threshold (kopiyky). Null until «Підтвердити» is pressed. */
  const [customAmount, setCustomAmount] = useState<number | null>(initialCustomAmount ?? null);

  const title = paused
    ? 'Сповіщення призупинено'
    : editing
      ? 'Сповіщення про ціну'
      : 'Коли повідомити про ціну?';

  const subParts: string[] = [`«${bookTitle}»`];
  if (currentPrice != null) subParts.push(`зараз ${formatMoney(currentPrice)}`);
  if (store != null) subParts.push(`у ${store}`);
  const subText = subParts.join(' · ');

  /** The typed value parsed to kopiyky, or null when it is not a usable price. */
  const typedAmount: number | null = (() => {
    const parsed = parseFloat(customAmountStr.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100);
  })();

  const customDirty = typedAmount !== customAmount;

  const resolvedAmount = resolveTargetAmount(selectedIntent, {
    currentAmount: currentPrice?.amount ?? null,
    typicalRangeMin: favourablePrice,
    customAmount,
  });

  const submitDisabled = busy || resolvedAmount === null;

  function handleSubmit(): void {
    if (resolvedAmount === null) return;
    onSubmit(selectedIntent, resolvedAmount);
  }

  /** Per-mode threshold shown on the right of each option. */
  function priceFor(key: AlertIntent): string {
    if (key === 'below-current') {
      return currentPrice != null ? `< ${formatMoney(currentPrice)}` : '';
    }
    if (key === 'favourable-price') {
      return favourablePrice != null
        ? `< ${formatMoney({ amount: favourablePrice, currency: 'UAH' })}`
        : '';
    }
    if (key === 'custom-price') {
      return customAmount != null
        ? `< ${formatMoney({ amount: customAmount, currency: 'UAH' })}`
        : '';
    }
    return '';
  }

  /** A mode is unavailable when its threshold cannot be resolved at all. */
  function disabledReason(key: AlertIntent): string | null {
    if (key === 'favourable-price' && favourablePrice == null) {
      // Never restate the current price here — that is what made this mode
      // indistinguishable from «Нижче за поточну».
      return favourableState === 'collecting' ? 'Визначаємо вигідну ціну' : 'Недоступно';
    }
    if ((key === 'any-drop' || key === 'below-current') && currentPrice == null) {
      return 'Немає поточної ціни';
    }
    return null;
  }

  return (
    <div className="al-config">
      <div className="al-config__head">
        <div className="al-config__headmain">
          <span className="al-config__title" id={titleId}>{title}</span>
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
              на ціль {targetPrice != null && <b>{formatMoney(targetPrice)}</b>}.
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
        /* ── Intent form ──────────────────────────────────────────────── */
        <>
          <div className="al-opts" role="radiogroup" aria-label="Коли повідомити">
            {ALERT_INTENTS.map((intentDef) => {
              const reason = disabledReason(intentDef.key);
              const isDisabled = reason !== null;
              const isSelected = selectedIntent === intentDef.key;
              const priceText = priceFor(intentDef.key);

              return (
                <button
                  key={intentDef.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={isDisabled || undefined}
                  className={[
                    'al-opt',
                    isSelected ? 'al-opt--on' : '',
                    isDisabled ? 'al-opt--disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={isDisabled}
                  onClick={isDisabled ? undefined : () => setSelectedIntent(intentDef.key)}
                >
                  <span className="al-radio" aria-hidden />
                  <span className="al-opt__main">
                    <span className="al-opt__label">{intentDef.label}</span>
                    <span className="al-opt__desc">{reason ?? intentDef.desc}</span>
                  </span>
                  {priceText !== '' && !isDisabled && (
                    <span className="al-opt__price">{priceText}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Inline custom-price field — expands under the grid, never a second dialog. */}
          {selectedIntent === 'custom-price' && (
            <div className="al-custom">
              <label className="al-custom__label" htmlFor="al-custom-price">
                Вказати свою ціну
              </label>
              <div className="al-custom__row">
                <span className="al-custom__field">
                  <input
                    id="al-custom-price"
                    className="kn-input"
                    type="text"
                    inputMode="numeric"
                    value={customAmountStr}
                    onChange={(e) => setCustomAmountStr(e.target.value)}
                    placeholder="500"
                  />
                  <span className="al-custom__unit" aria-hidden>₴</span>
                </span>
                <Button
                  variant="secondary"
                  disabled={typedAmount === null || !customDirty}
                  onClick={() => setCustomAmount(typedAmount)}
                >
                  Підтвердити
                </Button>
              </div>
              <span className="al-custom__hint">
                {customAmount != null && !customDirty ? (
                  <>
                    <Check size={13} aria-hidden />
                    Поріг — нижче {formatMoney({ amount: customAmount, currency: 'UAH' })}
                  </>
                ) : (
                  'Введіть ціну й натисніть «Підтвердити».'
                )}
              </span>
            </div>
          )}

          {editing && onPause != null && (
            <div className="al-manage">
              <button type="button" className="al-manage__btn" onClick={onPause}>
                <BellOff size={15} aria-hidden />
                Призупинити сповіщення
              </button>
            </div>
          )}

          <div className="al-config__foot">
            <Clock size={14} aria-hidden />
            <span>
              Knyhovo перевіряє ціни щодня о 08:00 — щойно ціль досягнута, Книговик одразу напише
              на пошту.
            </span>
          </div>

          <div className="al-config__actions">
            {editing ? (
              <Button variant="ghost" onClick={onRemove}>
                Прибрати сповіщення
              </Button>
            ) : (
              <Button variant="ghost" onClick={onCancel}>
                Скасувати
              </Button>
            )}
            <Button variant="primary" disabled={submitDisabled} onClick={handleSubmit}>
              Зберегти
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
