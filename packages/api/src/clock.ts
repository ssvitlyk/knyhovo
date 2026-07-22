/**
 * Narrow clock seam. Injecting a `Clock` (instead of calling `new Date()`
 * inline) lets a build pin a single `now` for its whole duration and lets tests
 * run against a fixed instant — no dependency on the system clock.
 */
export interface Clock {
  now(): Date;
}

/** Production default. */
export const systemClock: Clock = { now: () => new Date() };

/** Test/helper clock pinned to a fixed instant. */
export function fixedClock(instant: Date): Clock {
  return { now: () => instant };
}
