'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ds/Badge';
import { AlertToast } from '@/components/alerts/AlertToast';
import { updateNotificationPreferences } from '@/lib/api/notifications';
import type { NotificationPreferencesDto } from '@/lib/api/types';
import { PrefCard } from './PrefCard';
import { NotificationsHead, NOTIFICATIONS_TITLE, NOTIFICATIONS_SUBTITLE } from './NotificationsHead';

type PrefField = 'priceDropEnabled' | 'backInStockEnabled';

/** The two preference cards (frozen copy — single source of truth). */
const CARDS: readonly { readonly id: string; readonly field: PrefField; readonly title: string; readonly desc: string }[] = [
  {
    id: 'pricedrop',
    field: 'priceDropEnabled',
    title: 'Сповіщення про зниження ціни',
    desc: 'Отримайте листа, коли відстежувана книга досягне або опуститься нижче вашої цільової ціни.',
  },
  {
    id: 'backinstock',
    field: 'backInStockEnabled',
    title: 'Повернення в наявність',
    desc: "Отримайте листа, коли відстежувана книга, якої немає в наявності, з'явиться знову.",
  },
];

export interface NotificationsPanelProps {
  readonly initial: NotificationPreferencesDto;
}

/**
 * NotificationsPanel — client component that renders the notification
 * preferences UI. Handles autosave via PATCH on toggle change.
 */
export function NotificationsPanel({ initial }: NotificationsPanelProps): React.JSX.Element {
  const [prefs, setPrefs] = useState<Record<PrefField, boolean>>({
    priceDropEnabled: initial.priceDropEnabled,
    backInStockEnabled: initial.backInStockEnabled,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const dismissToast = useCallback(() => setToast(false), []);

  /** Pending auto-clear timer for the error note — cleared/re-armed per save so
   *  back-to-back server errors each show for the full window (no early clear). */
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (errorTimer.current != null) clearTimeout(errorTimer.current); }, []);

  async function handleToggle(field: PrefField): Promise<void> {
    // The `disabled={saving}` guard on both toggles serializes saves — no two
    // PATCH requests can be in flight at once, so rapid clicks can't race.
    const newValue = !prefs[field];
    setPrefs((p) => ({ ...p, [field]: newValue })); // optimistic
    setSaving(true);
    if (errorTimer.current != null) clearTimeout(errorTimer.current);
    setErrorNote(null);

    try {
      await updateNotificationPreferences({ [field]: newValue });
      setSaving(false);
      setToast(true);
    } catch {
      setPrefs((p) => ({ ...p, [field]: !newValue })); // revert
      setSaving(false);
      setErrorNote('Не вдалося зберегти налаштування. Спробуйте ще раз.');
      errorTimer.current = setTimeout(() => setErrorNote(null), 5000);
    }
  }

  if (initial.unsubscribed) {
    return (
      <div className="np-content">
        <div className="np-head np-head--unsub">
          <div className="np-head__text">
            <h1 className="np-title">{NOTIFICATIONS_TITLE}</h1>
          </div>
          <Badge tone="neutral">
            <AlertCircle size={13} aria-hidden /> Ви відписані від усіх сповіщень
          </Badge>
          <p className="np-subtitle">
            Поновити підписку можна за посиланням у будь-якому листі від Knyhovo.
          </p>
        </div>

        <div className="np-cards">
          {CARDS.map((c) => (
            <PrefCard key={c.id} id={c.id} title={c.title} desc={c.desc} on={false} disabled dimmed />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="np-content">
      <NotificationsHead subtitle={NOTIFICATIONS_SUBTITLE} />

      <div className="np-cards">
        {CARDS.map((c) => (
          <PrefCard
            key={c.id}
            id={c.id}
            title={c.title}
            desc={c.desc}
            on={prefs[c.field]}
            disabled={saving}
            onChange={() => { void handleToggle(c.field); }}
          />
        ))}
      </div>

      <div className="np-helper">
        <Check size={12} aria-hidden /> Зміни зберігаються автоматично
      </div>

      {errorNote != null && (
        <div className="al-note al-note--err" style={{ marginTop: 'var(--space-3)' }}>
          <span className="al-note__icon">
            <AlertCircle size={16} aria-hidden />
          </span>
          <div className="al-note__body">{errorNote}</div>
        </div>
      )}

      {toast && (
        <AlertToast onDismiss={dismissToast} durationMs={1800} className="np-toast">
          Налаштування збережено
        </AlertToast>
      )}
    </div>
  );
}
