'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useMounted } from './useClientMedia';

/** Minimum vertical/horizontal travel (px) before a swipe counts as a dismiss. */
const SWIPE_THRESHOLD = 40;

export interface AlertToastProps {
  /** The confirmation message content. */
  children: ReactNode;
  /** Called when the toast should be dismissed (after durationMs or on unmount). */
  onDismiss: () => void;
  /** Duration in milliseconds before auto-dismiss. Default: 4000. */
  durationMs?: number;
  /** Optional extra class applied to the inner `.al-toast` div. */
  className?: string;
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
  className = '',
}: AlertToastProps): React.JSX.Element | null {
  // false during SSR, true on the client (no setState-in-effect mount flag).
  const mounted = useMounted();

  /** Touch start coordinates — used to detect a swipe-to-dismiss gesture. */
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [mounted, onDismiss, durationMs]);

  if (!mounted) return null;

  function handleTouchStart(e: React.TouchEvent): void {
    const t = e.touches[0];
    touchStartRef.current = t != null ? { x: t.clientX, y: t.clientY } : null;
  }

  function handleTouchEnd(e: React.TouchEvent): void {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start == null) return;
    const t = e.changedTouches[0];
    if (t == null) return;
    // Dismiss on any swipe (down or sideways) past the threshold.
    if (Math.abs(t.clientX - start.x) > SWIPE_THRESHOLD || t.clientY - start.y > SWIPE_THRESHOLD) {
      onDismiss();
    }
  }

  return createPortal(
    <div className="al-toast-wrap" role="status">
      <div
        className={['al-toast', className].filter(Boolean).join(' ')}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <CheckCircle2 size={16} aria-hidden />
        {children}
        <button
          type="button"
          className="al-toast__dismiss"
          aria-label="Сховати сповіщення"
          onClick={onDismiss}
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  );
}
