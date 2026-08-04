'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAlert, pauseAlert, removeAlert, AlertError } from '@/lib/api/priceAlerts';
import type { AlertDto, AlertMode, AlertState, MoneyDto } from '@/lib/api/types';

export interface AlertControllerArgs {
  /** The canonical book id (must already be in the wishlist before calling mutating actions). */
  readonly bookId: string;
  /** Initial alert state fetched server-side; null means no alert configured. */
  readonly initialAlert: AlertDto | null;
  /** Best price today (kopiyky); used only for display, never for client-side computation. */
  readonly currentPrice: MoneyDto | null;
}

export interface AlertController {
  /** Optimistic local copy of the alert (updated immediately on success). */
  readonly alert: AlertDto | null;
  /** The alert's server-derived state, or `'saved'` when there is no alert yet. */
  readonly uiState: AlertState | 'saved';
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
   * On success: sets the local alert to the server's returned AlertDto (never
   * reconstructed locally), closes config, shows toast, calls router.refresh().
   */
  readonly submit: (mode: AlertMode, threshold?: { amount: number; currency: 'UAH' }) => Promise<void>;
  /** Pause the alert. On success: optimistic state='paused', toast, closes config, router.refresh(). */
  readonly pause: () => Promise<void>;
  /** Resume a paused alert. On success: optimistic state='armed', toast, closes config, router.refresh(). */
  readonly resume: () => Promise<void>;
  /** Remove the alert. On success: local alert null, closes config, toast, router.refresh(). */
  readonly remove: () => Promise<void>;
}

/**
 * useAlertController — shared client-side controller hook for all alert surfaces.
 * Encapsulates mutation logic (create/edit/pause/resume/remove), optimistic local state,
 * toast confirmations and error notes. Reused by Book Details and Wishlist surfaces.
 *
 * Pure pass-through of the server's model (notifications-model-v2): `submit`
 * never reconstructs an `AlertDto` — it takes whatever `PUT .../alert` returns.
 * `pause`/`resume` don't get a fresh DTO back from `PATCH`, so they patch only
 * `state`/`pausedAt` on the existing optimistic copy.
 *
 * @param args - see {@link AlertControllerArgs}
 */
export function useAlertController({
  bookId,
  initialAlert,
  currentPrice: _currentPrice,
}: AlertControllerArgs): AlertController {
  const router = useRouter();

  const [alert, setLocalAlert] = useState<AlertDto | null>(initialAlert);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const uiState: AlertState | 'saved' = alert === null ? 'saved' : alert.state;

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

  async function submit(
    mode: AlertMode,
    threshold?: { amount: number; currency: 'UAH' },
  ): Promise<void> {
    setBusy(true);
    setErrorNote(null);

    const isEdit = alert !== null;

    try {
      const nextAlert = await setAlert(bookId, mode, threshold);

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

      // Optimistic update: keep existing alert data, flip state to paused.
      // PATCH doesn't return a fresh AlertDto — pausedAt is left null; chips/
      // targets key off state only, not pausedAt.
      if (alert !== null) {
        setLocalAlert({ ...alert, state: 'paused', pausedAt: null });
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
        setLocalAlert({ ...alert, state: 'armed', pausedAt: null });
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
