'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KnhIcon } from './KnhIcon';

export interface MobileSearchOverlayProps {
  readonly onClose: () => void;
}

/**
 * Mobile search overlay (`.knh-so`) — dims the page, drops a full search bar
 * from the top. Autofocused; submits to `/search?q=…` then closes. Escape and
 * body-scroll-lock are handled by the parent `MobileHeader`.
 */
export function MobileSearchOverlay({ onClose }: MobileSearchOverlayProps): React.JSX.Element {
  const [q, setQ] = useState('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push('/search?q=' + encodeURIComponent(query));
    onClose();
  }

  return (
    <div className="knh-so" role="dialog" aria-modal="true" aria-label="Пошук">
      <div className="knh-so__backdrop" onClick={onClose} />
      <form className="knh-so__panel" role="search" onSubmit={handleSubmit}>
        <div className="knh-so__field">
          <KnhIcon name="search" size={20} />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук книги, автора або ISBN"
            aria-label="Пошук книги, автора або ISBN"
          />
          {q.length > 0 && (
            <button
              type="button"
              className="knh__clear"
              aria-label="Очистити"
              onClick={() => {
                setQ('');
                inputRef.current?.focus();
              }}
            >
              <KnhIcon name="x" size={18} />
            </button>
          )}
        </div>
        <button type="submit" className="knh-so__go">
          Знайти
        </button>
      </form>
    </div>
  );
}
