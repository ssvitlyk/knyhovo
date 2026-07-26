'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useIsMobile, useMounted } from './useClientMedia';

export interface AlertSurfaceProps {
  /** Whether the surface is open. */
  open: boolean;
  /** Called when the surface should close (Escape, outside click, scrim click). */
  onClose: () => void;
  /** The surface content (typically AlertConfig). */
  children: ReactNode;
  /** Optional id for the dialog's aria-labelledby. */
  titleId?: string;
}

/** All focusable element selectors for focus-trap logic. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Returns all focusable elements within a container. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/**
 * AlertSurface — responsive dialog container. Renders as a centred overlay
 * dialog on desktop (≥768px) and as a bottom sheet on mobile (<768px).
 * Implements focus trap, Escape-to-close, scrim-click-to-close and
 * body-scroll lock on both breakpoints.
 *
 * Desktop was an absolutely-positioned popover anchored to the trigger; it is
 * now centred, because the configurator is a desktop-first two-column form that
 * no longer fits (or reads) as a dropdown hanging off a 52px row.
 *
 * Returns `null` when `open` is false.
 */
export function AlertSurface({
  open,
  onClose,
  children,
  titleId,
}: AlertSurfaceProps): React.JSX.Element | null {
  // Client-only viewport + mount state (useSyncExternalStore, no setState-in-effect).
  const isMobile = useIsMobile();
  const mounted = useMounted();

  const containerRef = useRef<HTMLDivElement>(null);
  /** The element that had focus before the surface opened — restored on close. */
  const previousFocusRef = useRef<Element | null>(null);

  // Capture previous focus; move focus into the surface on open.
  useEffect(() => {
    if (!mounted || !open) return;

    previousFocusRef.current = document.activeElement;

    // Defer to next tick so the DOM is ready.
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container == null) return;
      const first = getFocusable(container)[0];
      if (first != null) {
        first.focus();
      } else {
        container.focus();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [mounted, open]);

  // Restore focus on close.
  useEffect(() => {
    if (open) return;
    const prev = previousFocusRef.current;
    if (prev instanceof HTMLElement) {
      prev.focus();
    }
    previousFocusRef.current = null;
  }, [open]);

  // Keyboard handler: Escape closes; Tab traps within the surface.
  useEffect(() => {
    if (!mounted || !open) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const container = containerRef.current;
        if (container == null) return;
        const focusable = getFocusable(container);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, open, onClose]);

  // Lock body scroll while the surface is open (both breakpoints — desktop is a
  // centred modal now, so the page must not scroll behind it either).
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mounted, open]);

  if (!open || !mounted) return null;

  if (isMobile) {
    // Mobile bottom sheet — portalled to document.body.
    return createPortal(
      <div className="al-overlay">
        <div className="al-overlay__scrim" onClick={onClose} />
        <div
          className="al-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={containerRef}
          // Fallback focus target when no focusable children are rendered yet.
          tabIndex={-1}
        >
          <span className="al-sheet__grab" aria-hidden />
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  // Desktop centred dialog — portalled so no ancestor (sticky panel, overflow,
  // stacking context) can clip or mis-anchor it.
  return createPortal(
    <div className="al-overlay al-overlay--center">
      <div className="al-overlay__scrim" onClick={onClose} />
      <div
        className="al-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={containerRef}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
