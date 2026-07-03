'use client';

import { useEffect, useRef, useState } from 'react';
import { knBookWord } from '@/lib/format';

export interface InfoHeaderProps {
  readonly title: string;
  readonly description: string | null;
  readonly count: number;
}

/**
 * Compact info header — title + book count on one row, then an optional
 * clamped description with a «Показати більше/Згорнути» toggle that only
 * appears when the text actually overflows its 2-line clamp (measured via
 * `scrollHeight` vs `clientHeight`, mirrors the frozen `InfoHeader`).
 */
export function InfoHeader({ title, description, count }: InfoHeaderProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      setOverflow(el.scrollHeight - el.clientHeight > 2);
    });
    return () => cancelAnimationFrame(id);
  }, [description]);

  return (
    <div className="cd-info">
      <div className="cd-titlerow">
        <h1 className="cd-title">{title}</h1>
        <span className="cd-count">
          <b>{count}</b> {knBookWord(count)}
        </span>
      </div>
      {description ? (
        <>
          <p ref={ref} className={'cd-desc' + (open ? ' cd-desc--open' : '')}>
            {description}
          </p>
          {overflow ? (
            <button type="button" className="cd-desc-toggle" onClick={() => setOpen((o) => !o)}>
              {open ? 'Згорнути' : 'Показати більше'}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
