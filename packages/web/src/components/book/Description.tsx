'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface DescriptionProps {
  readonly text: string;
}

// Use useLayoutEffect in browser, useEffect in SSR (avoids warning)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function Description({ text }: DescriptionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const pRef = useRef<HTMLParagraphElement>(null);

  useIsomorphicLayoutEffect(() => {
    const check = (): void => {
      const p = pRef.current;
      if (!p) return;
      setOverflowing(p.scrollHeight > p.clientHeight + 1);
    };

    check();
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
    };
  }, [text]);

  return (
    <div className="bd-desc">
      <p
        ref={pRef}
        className={`bd-desc__text${!expanded ? ' bd-desc__text--clamped' : ''}`}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          className="bd-desc__toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Згорнути' : 'Показати все'}
        </button>
      )}
    </div>
  );
}
