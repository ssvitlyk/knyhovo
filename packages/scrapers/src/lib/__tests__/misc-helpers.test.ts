import { describe, it, expect, vi } from 'vitest';
import { sleep } from '../sleep.js';
import { errMsg } from '../errors.js';
import { NOOP_LOGGER } from '../noop-logger.js';

describe('sleep', () => {
  it('resolves after the given delay', async () => {
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
    vi.useRealTimers();
  });
});

describe('errMsg', () => {
  it('returns message for Error and String() otherwise', () => {
    expect(errMsg(new Error('boom'))).toBe('boom');
    expect(errMsg('plain')).toBe('plain');
    expect(errMsg(42)).toBe('42');
    expect(errMsg(null)).toBe('null');
  });
});

describe('NOOP_LOGGER', () => {
  it('info is callable and returns undefined', () => {
    expect(NOOP_LOGGER.info('x')).toBeUndefined();
  });
});
