'use client';

import { useCallback, useState } from 'react';
import { knBookWord } from '@/lib/format';

export interface InfoHeaderProps {
  readonly title: string;
  readonly description: string;
  readonly count: number;
}

/**
 * Compact info head of the Collection Details template (frozen §7): title +
 * book count + short description with an overflow «Показати більше» toggle
 * when the clamped description doesn't fit. No big hero. Render with a
 * `key={slug}` so state resets when the collection changes.
 */
export function InfoHeader({ title, description, count }: InfoHeaderProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);

  // Callback ref: measure the clamped paragraph once it's laid out.
  const measureRef = useCallback((el: HTMLParagraphElement | null) => {
    if (!el) return;
    requestAnimationFrame(() => {
      setOverflow(el.scrollHeight - el.clientHeight > 2);
    });
  }, []);

  return (
    <div className="cd-info">
      <div className="cd-titlerow">
        <h1 className="cd-title">{title}</h1>
        <span className="cd-count">
          <b>{count}</b> {knBookWord(count)}
        </span>
      </div>
      <p ref={measureRef} className={'cd-desc' + (open ? ' cd-desc--open' : '')}>
        {description}
      </p>
      {overflow ? (
        <button type="button" className="cd-desc-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? 'Згорнути' : 'Показати більше'}
        </button>
      ) : null}
    </div>
  );
}
