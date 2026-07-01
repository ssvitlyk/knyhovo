'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useMounted } from '@/components/alerts/useClientMedia';

/** All focusable element selectors for focus-trap logic. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

export interface ModalProps {
  /** Whether the modal is open. */
  readonly open: boolean;
  /** Called on Escape, overlay click, or the close button. */
  readonly onClose: () => void;
  /** Accessible label for the dialog. */
  readonly label: string;
  /** Modal body (typically the LoginForm). */
  readonly children: ReactNode;
}

/**
 * Modal — a minimal centred overlay dialog rendered via a portal. Reuses the
 * same focus-trap / Escape / scroll-lock approach as AlertSurface (the app has
 * no centred-modal primitive). SSR-safe; returns null until mounted/open.
 */
export function Modal({ open, onClose, label, children }: ModalProps): React.JSX.Element | null {
  const mounted = useMounted();
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Capture previous focus and move focus into the dialog on open.
  useEffect(() => {
    if (!mounted || !open) return;
    previousFocusRef.current = document.activeElement;
    const raf = requestAnimationFrame(() => {
      const container = contentRef.current;
      if (container == null) return;
      const first = getFocusable(container)[0];
      (first ?? container).focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [mounted, open]);

  // Restore focus on close.
  useEffect(() => {
    if (open) return;
    const prev = previousFocusRef.current;
    if (prev instanceof HTMLElement) prev.focus();
    previousFocusRef.current = null;
  }, [open]);

  // Escape closes; Tab is trapped within the dialog.
  useEffect(() => {
    if (!mounted || !open) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const container = contentRef.current;
        if (container == null) return;
        const focusable = getFocusable(container);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mounted, open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mounted, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="ml-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ml-modal__content" role="dialog" aria-modal="true" aria-label={label} ref={contentRef} tabIndex={-1}>
        <button type="button" className="ml-modal__close" aria-label="Закрити" onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
