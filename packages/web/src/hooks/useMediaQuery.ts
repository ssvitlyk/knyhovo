'use client';

import { useCallback, useSyncExternalStore } from 'react';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * Reactive CSS media-query match, SSR-safe via `useSyncExternalStore`: the
 * server (and hydration) snapshot is `serverSnapshot`, the client subscribes to
 * the matchMedia `change` event — no hydration mismatch, no setState-in-effect
 * cascade. Where `matchMedia` is unavailable the snapshot is `false`.
 */
export function useMediaQuery(query: string, serverSnapshot: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!hasMatchMedia()) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (hasMatchMedia() ? window.matchMedia(query).matches : false),
    () => serverSnapshot,
  );
}
