'use client';

import { useSyncExternalStore } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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

/**
 * useIsMobile — true when the viewport is below the bottom-sheet breakpoint
 * (<768px). Subscribes to matchMedia change events and returns false on the
 * server (and where matchMedia is unavailable), so the surface defaults to the
 * desktop popover until the client confirms otherwise.
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)', false);
}
