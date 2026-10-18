'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * `useIsDesktop` — reactive `(min-width: 769px)` match, port of the `isDesktop`
 * state in `WL21Discounts` (`wl22-app.jsx`). The server snapshot defaults to
 * desktop `true` (matches `WL21Discounts`'s initial-state assumption), which
 * avoids a mobile→desktop content flash on hydration.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 769px)', true);
}
