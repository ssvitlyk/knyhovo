'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KnhIcon } from './KnhIcon';

/**
 * Desktop search capsule (`.knh__search`) — a quiet part of the header, never
 * the dominant element. Submits to the canonical `/search?q=…` route; the
 * on-page SearchControl on `/search` is untouched and coexists with this.
 */
export function HeaderSearch(): React.JSX.Element {
  const [q, setQ] = useState('');
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push('/search?q=' + encodeURIComponent(query));
  }

  return (
    <form className="knh__search" role="search" onSubmit={handleSubmit}>
      <KnhIcon name="search" size={18} />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Пошук книги, автора або ISBN"
        aria-label="Пошук книги, автора або ISBN"
      />
      {q.length > 0 && (
        <button type="button" className="knh__clear" aria-label="Очистити" onClick={() => setQ('')}>
          <KnhIcon name="x" size={16} />
        </button>
      )}
    </form>
  );
}
