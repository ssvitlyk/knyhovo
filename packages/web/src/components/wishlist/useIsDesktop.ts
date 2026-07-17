'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 769px)';

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Server snapshot defaults to desktop `true` (matches `WL21Discounts`'s initial-state assumption). */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * `useIsDesktop` — reactive `(min-width: 769px)` match via `useSyncExternalStore`,
 * port of the `isDesktop` state in `WL21Discounts` (`wl22-app.jsx`). Desktop-first
 * server snapshot avoids a mobile→desktop content flash on hydration.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
