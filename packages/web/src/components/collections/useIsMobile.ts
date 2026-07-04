'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Mobile-first viewport hook (frozen mock's `useIsMobile`), SSR-safe via
 * `useSyncExternalStore`: the server snapshot is `false` (desktop markup), the
 * client subscribes to the matchMedia change event — no hydration mismatch, no
 * setState-in-effect cascade.
 */
export function useIsMobile(bp = 768): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(`(max-width: ${bp}px)`);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [bp],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(`(max-width: ${bp}px)`).matches,
    () => false,
  );
}
