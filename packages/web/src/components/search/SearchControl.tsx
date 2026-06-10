'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchBar } from '@/components/ds/SearchBar';

/** Build the `/search` URL for a query, resetting pagination to page 1. */
function searchHref(query: string): string {
  const trimmed = query.trim();
  return trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search';
}

/**
 * Interactive search field (frozen typing state). Holds the input value locally
 * and navigates by updating the `q` URL param; the server re-renders results.
 * Shows the "× Очистити запит" clear control while there is input.
 */
export function SearchControl({ initialQuery }: { readonly initialQuery: string }): React.JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (next: string): void => {
    // An empty / whitespace-only query resets to the initial state (`/search`,
    // no `q`); `searchHref` returns `/search` for blank input.
    router.push(searchHref(next));
  };

  const clear = (): void => {
    setValue('');
    router.push('/search');
  };

  return (
    <div className="results__search">
      <SearchBar value={value} onChange={setValue} onSearch={submit} />
      {value.length > 0 ? (
        <button type="button" className="results__search-clear" onClick={clear}>
          × Очистити запит
        </button>
      ) : null}
    </div>
  );
}
