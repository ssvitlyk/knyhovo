'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/format';

export interface AdaptiveBuyCtaProps {
  /** Price in kopiyky. */
  readonly price: number;
  readonly currency: string;
  /** External store URL (target/rel per the app's external-link convention). */
  readonly href: string;
  readonly className?: string;
}

/**
 * Adaptive «Купити за N ₴» CTA — port of `WL21FeatBuyCta`. Auto-collapses to
 * just «N ₴» when the fuller label can't fit at the button's measured width;
 * never shrinks the font, never wraps. Shared by «Порада Книговика» (mobile)
 * and the «Зараз вигідно купити» mobile rail card (frozen rule).
 */
export function AdaptiveBuyCta({
  price,
  currency,
  href,
  className,
}: AdaptiveBuyCtaProps): React.JSX.Element {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [full, setFull] = useState(true);

  const money = formatMoney({ amount: price, currency });
  const fullLabel = `Купити за ${money}`;

  useLayoutEffect(() => {
    const check = (): void => {
      const btn = btnRef.current;
      const measure = measureRef.current;
      if (!btn || !measure) return;
      const cs = getComputedStyle(btn);
      const padLeft = parseFloat(cs.paddingLeft) || 0;
      const padRight = parseFloat(cs.paddingRight) || 0;
      const avail = btn.clientWidth - padLeft - padRight;
      // 2px safety margin against sub-pixel rounding.
      setFull(measure.offsetWidth <= avail - 2);
    };
    check();

    let alive = true;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (alive) requestAnimationFrame(check);
      });
    }

    if (typeof ResizeObserver === 'undefined' || !btnRef.current) return undefined;
    const ro = new ResizeObserver(() => requestAnimationFrame(check));
    ro.observe(btnRef.current);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [price, currency]);

  return (
    <a
      ref={btnRef}
      className={`wl-btn ${className ?? 'wl21-featm__buy'}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={fullLabel}
      onClick={(e) => e.stopPropagation()}
    >
      <span ref={measureRef} className="wl21-featm__measure" aria-hidden="true">
        {fullLabel}
      </span>
      {full ? fullLabel : money}
    </a>
  );
}
