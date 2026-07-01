'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ds/Button';

/**
 * Profile error boundary — shown when the server fetch throws.
 * Renders the frozen `.al-note--err` card with a retry action.
 */
export default function ProfileError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <div className="np-content">
      <div className="np-head">
        <div className="np-head__text">
          <h1 className="np-title">Профіль</h1>
          <p className="np-subtitle">Особисті дані та доступ до облікового запису Knyhovo.</p>
        </div>
      </div>
      <div className="al-note al-note--err" style={{ maxWidth: 520 }}>
        <span className="al-note__icon">
          <AlertCircle size={18} aria-hidden />
        </span>
        <div className="al-note__body">
          Не вдалося завантажити профіль. Перевірте з&apos;єднання та спробуйте ще раз.
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
