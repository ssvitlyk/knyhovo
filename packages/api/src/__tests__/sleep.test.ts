import { describe, it, expect, vi, afterEach } from 'vitest';
import { sleep } from '../sleep.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('sleep', () => {
  it('resolves only after the delay has elapsed', async () => {
    vi.useFakeTimers();
    let done = false;
    const p = sleep(500).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });
});
