'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { NotificationsHead, NOTIFICATIONS_SUBTITLE } from '@/components/settings/NotificationsHead';

/**
 * Notifications error boundary — shown when the server fetch throws.
 * Renders the frozen `.al-note--err` card with a retry action.
 */
export default function NotificationsError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <div className="np-content">
      <NotificationsHead subtitle={NOTIFICATIONS_SUBTITLE} />
      <div className="al-note al-note--err" style={{ maxWidth: 520 }}>
        <span className="al-note__icon">
          <AlertCircle size={18} aria-hidden />
        </span>
        <div className="al-note__body">
          Не вдалося завантажити налаштування сповіщень. Перевірте з&apos;єднання та спробуйте ще раз.
        </div>
        <div className="al-note__action">
          <Button variant="secondary" size="sm" className="np-retry" onClick={() => reset()}>
            <RefreshCw size={14} aria-hidden /> Спробувати ще раз
          </Button>
        </div>
      </div>
    </div>
  );
}
