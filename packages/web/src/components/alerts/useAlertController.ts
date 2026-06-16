'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { alertUiState } from '@/lib/alerts';
import type { AlertUiState } from '@/lib/alerts';
import { setAlert, pauseAlert, removeAlert, AlertError } from '@/lib/api/priceAlerts';
import type { AlertDto, AlertIntent, MoneyDto } from '@/lib/api/types';

export interface AlertControllerArgs {
  /** The canonical book id (must already be in the wishlist before calling mutating actions). */
  readonly bookId: string;
  /** Initial alert state fetched server-side; null means no alert configured. */
  readonly initialAlert: AlertDto | null;
  /** Best price today (kopiyky); drives below-current / any-drop targets and the sub-heading. */
  readonly currentPrice: MoneyDto | null;
  /** Typical-range minimum from Price History (kopiyky); null → favourable-price intent disabled. */
  readonly typicalRangeMin: number | null;
}

export interface AlertController {
  /** Optimistic local copy of the alert (updated immediately on success). */
  readonly alert: AlertDto | null;
  /** Derived UI state from the local alert copy. */
  readonly uiState: AlertUiState;
  /** Whether the AlertConfig surface is open. */
  readonly open: boolean;
  /** True while any mutation request is in flight. */
  readonly busy: boolean;
  /** Error message shown inside the config form; null when no error. */
  readonly errorNote: string | null;
  /** Success / confirmation message for AlertToast; null when none pending. */
  readonly toast: string | null;
  /** Open the AlertConfig surface (clears any existing errorNote). */
  readonly openConfig: () => void;
  /** Close the AlertConfig surface. */
  readonly closeConfig: () => void;
  /** Dismiss the confirmation toast. */
  readonly dismissToast: () => void;
  /**
   * Create or update the alert (AlertConfig primary action).
   * On success: updates local alert optimistically, closes config, shows toast, calls router.refresh().
   */
  readonly submit: (intent: AlertIntent, targetAmount: number) => Promise<void>;
  /** Pause the alert. On success: optimistic status='paused', toast, closes config, router.refresh(). */
  readonly pause: () => Promise<void>;
  /** Resume a paused alert. On success: optimistic status='active', toast, closes config, router.refresh(). */
  readonly resume: () => Promise<void>;
  /** Remove the alert. On success: local alert null, closes config, toast, router.refresh(). */
  readonly remove: () => Promise<void>;
}

/**
 * useAlertController — shared client-side controller hook for all alert surfaces.
 * Encapsulates mutation logic (create/edit/pause/resume/remove), optimistic local state,
 * toast confirmations and error notes. Reused by Book Details and Wishlist surfaces.
 *
 * @param args - see {@link AlertControllerArgs}
 */
export function useAlertController({
  bookId,
  initialAlert,
  currentPrice: _currentPrice,
  typicalRangeMin: _typicalRangeMin,
}: AlertControllerArgs): AlertController {
  const router = useRouter();

  const [alert, setLocalAlert] = useState<AlertDto | null>(initialAlert);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const uiState = alertUiState(alert);

  function openConfig(): void {
    setErrorNote(null);
    setOpen(true);
  }

  function closeConfig(): void {
    setOpen(false);
  }

  function dismissToast(): void {
    setToast(null);
  }

  async function submit(intent: AlertIntent, targetAmount: number): Promise<void> {
    setBusy(true);
    setErrorNote(null);

    const isEdit = alert !== null;

    try {
      await setAlert(bookId, intent, { amount: targetAmount, currency: 'UAH' });

      const nextAlert: AlertDto = {
        status: 'active',
        intent,
        targetPrice: { amount: targetAmount, currency: 'UAH' },
        pausedAt: null,
      };

      setLocalAlert(nextAlert);
      setOpen(false);
      setToast(isEdit ? 'Сповіщення оновлено' : 'Сповіщення увімкнено');
      router.refresh();
    } catch (err) {
      if (err instanceof AlertError) {
        setErrorNote(err.message);
      } else {
        throw err;
      }
    } finally {
      setBusy(false);
    }
  }

  async function pause(): Promise<void> {
    setBusy(true);
    setErrorNote(null);

    try {
      await pauseAlert(bookId, true);

      // Optimistic update: keep existing alert data, flip status to paused.
      // We do NOT compute a real timestamp — set pausedAt to null; chips/targets
      // key off status only, not pausedAt.
      if (alert !== null) {
        setLocalAlert({ ...alert, status: 'paused', pausedAt: null });
      }
      setOpen(false);
      setToast('Сповіщення призупинено');
      router.refresh();
    } catch (err) {
      if (err instanceof AlertError) {
        setErrorNote(err.message);
      } else {
        throw err;
      }
    } finally {
      setBusy(false);
    }
  }

  async function resume(): Promise<void> {
    setBusy(true);
    setErrorNote(null);

    try {
      await pauseAlert(bookId, false);

      if (alert !== null) {
        setLocalAlert({ ...alert, status: 'active', pausedAt: null });
      }
      setOpen(false);
      setToast('Сповіщення поновлено');
      router.refresh();
    } catch (err) {
      if (err instanceof AlertError) {
        setErrorNote(err.message);
      } else {
        throw err;
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    setErrorNote(null);

    try {
      await removeAlert(bookId);
      setLocalAlert(null);
      setOpen(false);
      setToast('Сповіщення прибрано');
      router.refresh();
    } catch (err) {
      if (err instanceof AlertError) {
        setErrorNote(err.message);
      } else {
        throw err;
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    alert,
    uiState,
    open,
    busy,
    errorNote,
    toast,
    openConfig,
    closeConfig,
    dismissToast,
    submit,
    pause,
    resume,
    remove,
  };
}
