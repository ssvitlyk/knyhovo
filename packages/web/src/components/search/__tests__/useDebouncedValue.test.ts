import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 200));
    expect(result.current).toBe('hello');
  });

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'hello' } },
    );

    rerender({ value: 'world' });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('hello');
  });

  it('updates to the latest value after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'hello' } },
    );

    rerender({ value: 'world' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('world');
  });

  it('resets the timer on rapid changes and only emits the final value', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: 'c' });
    act(() => { vi.advanceTimersByTime(100); });

    // Only 100ms since last change — still pending.
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(100); });

    // Now 200ms since last change ('c').
    expect(result.current).toBe('c');
  });

  it('clears the timer on unmount without updating state', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'initial' } },
    );

    rerender({ value: 'changed' });
    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // After unmount the debounced value should remain at the last committed state
    // (initial) — no state update fires on an unmounted component.
    expect(result.current).toBe('initial');
  });
});
