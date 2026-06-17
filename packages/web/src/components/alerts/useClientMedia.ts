'use client';

import { useSyncExternalStore } from 'react';

/** Stable no-op subscriber for client-only state that never changes after mount. */
const subscribeNever = (): (() => void) => () => {};

/**
 * useMounted — false during SSR / first hydration pass, true once running on the
 * client. Expressed with useSyncExternalStore (not a setState-in-effect mount
 * flag) so it is lint-clean and avoids a cascading post-mount render.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

const MOBILE_QUERY = '(max-width: 767px)';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function subscribeMobile(callback: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', callback);
  return () => {
    mq.removeEventListener('change', callback);
  };
}

function getMobileSnapshot(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * useIsMobile — true when the viewport is below the bottom-sheet breakpoint
 * (<768px). Subscribes to matchMedia change events via useSyncExternalStore and
 * returns false on the server (and where matchMedia is unavailable), so the
 * surface defaults to the desktop popover until the client confirms otherwise.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
}
