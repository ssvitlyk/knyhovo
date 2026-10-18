'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * Mobile-first viewport hook (frozen mock's `useIsMobile`), SSR-safe: the server
 * snapshot is `false` (desktop markup), the client follows the matchMedia query.
 */
export function useIsMobile(bp = 768): boolean {
  return useMediaQuery(`(max-width: ${bp}px)`, false);
}
