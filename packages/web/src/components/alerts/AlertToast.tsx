'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useMounted } from './useClientMedia';

export interface AlertToastProps {
  /** The confirmation message content. */
  children: ReactNode;
  /** Called when the toast should be dismissed (after durationMs or on unmount). */
  onDismiss: () => void;
  /** Duration in milliseconds before auto-dismiss. Default: 4000. */
  durationMs?: number;
}

/**
 * AlertToast — a fixed floating confirmation rendered via a React portal to
 * document.body. Auto-dismisses after `durationMs` milliseconds.
 * SSR-safe: the portal is only rendered after mount (client-side only).
 */
export function AlertToast({
  children,
  onDismiss,
  durationMs = 4000,
}: AlertToastProps): React.JSX.Element | null {
  // false during SSR, true on the client (no setState-in-effect mount flag).
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [mounted, onDismiss, durationMs]);

  if (!mounted) return null;

  return createPortal(
    <div className="al-toast-wrap" role="status">
      <div className="al-toast">
        <CheckCircle2 size={16} aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
}
