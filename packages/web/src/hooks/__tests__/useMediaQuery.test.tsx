import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useMediaQuery } from '../useMediaQuery';

type Listener = () => void;

function stubMatchMedia(initial: boolean): { set: (v: boolean) => void; queries: string[] } {
  let matches = initial;
  const listeners = new Set<Listener>();
  const queries: string[] = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      queries.push(query);
      return {
        get matches() {
          return matches;
        },
        addEventListener: (_: string, l: Listener) => listeners.add(l),
        removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      };
    }),
  );
  return {
    queries,
    set: (v) => {
      matches = v;
      listeners.forEach((l) => l());
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('reads the current match and the exact query', () => {
    const mm = stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)', false));
    expect(result.current).toBe(true);
    expect(mm.queries).toContain('(max-width: 767px)');
  });

  it('updates when the media query changes', () => {
    const mm = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 769px)', true));
    expect(result.current).toBe(false);
    act(() => mm.set(true));
    expect(result.current).toBe(true);
  });

  it('falls back to false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 769px)', true));
    expect(result.current).toBe(false);
    unmount();
  });

  it('uses the server snapshot when rendering on the server', () => {
    function Probe({ server }: { server: boolean }): React.JSX.Element {
      return <span>{String(useMediaQuery('(min-width: 769px)', server))}</span>;
    }
    expect(renderToString(<Probe server />)).toContain('true');
    expect(renderToString(<Probe server={false} />)).toContain('false');
  });
});
