import type { Clock } from '../../clock.js';

/** Test clock pinned to a fixed instant. */
export function fixedClock(instant: Date): Clock {
  return { now: () => instant };
}
