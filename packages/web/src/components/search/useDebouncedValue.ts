'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has been stable for `delayMs`.
 * Each change resets the timer; the previous pending update is cancelled.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(id);
    };
  }, [value, delayMs]);

  return debounced;
}
