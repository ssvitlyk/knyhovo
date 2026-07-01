import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StickyCta } from '../StickyCta';
import type { MoneyDto } from '@/lib/api/types';

const PRICE: MoneyDto = { amount: 29900, currency: 'UAH' };

/** Install a controllable IntersectionObserver mock; returns the latest callback. */
function installObserver(): {
  fire: (isIntersecting: boolean, top: number) => void;
  disconnect: () => void;
} {
  let cb: IntersectionObserverCallback | null = null;
  const disconnect = vi.fn();
  class MockIO {
    constructor(callback: IntersectionObserverCallback) {
      cb = callback;
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = disconnect;
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
  return {
    fire: (isIntersecting, top) =>
      act(() =>
        cb?.(
          [{ isIntersecting, boundingClientRect: { top } } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      ),
    disconnect,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('StickyCta', () => {
  it('renders price, store, and a labelled purchase link', () => {
    installObserver();
    render(<StickyCta price={PRICE} store="BookClub" href="https://book-club.ua/x" />);

    expect(screen.getByText('299 ₴')).toBeInTheDocument();
    expect(screen.getByText(/BookClub/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Перейти до книгарні' });
    expect(link.getAttribute('href')).toBe('https://book-club.ua/x');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('is hidden initially and toggles data-visible when the best block leaves the viewport', () => {
    const observer = installObserver();
    const target = document.createElement('div');
    target.id = 'bd-best-block';
    document.body.appendChild(target);
    render(<StickyCta price={PRICE} store="BookClub" href="https://book-club.ua/x" />);
    // Target present so the observer is wired up.
    const bar = screen.getByRole('region', { name: 'Купити книгу — найкраща ціна' });
    expect(bar.getAttribute('data-visible')).toBe('false');

    observer.fire(false, -500); // best block scrolled ABOVE the viewport → show
    expect(bar.getAttribute('data-visible')).toBe('true');

    observer.fire(true, 0); // best block back in view → hide
    expect(bar.getAttribute('data-visible')).toBe('false');

    observer.fire(false, 800); // best block still BELOW the fold → stay hidden
    expect(bar.getAttribute('data-visible')).toBe('false');
  });

  it('stays hidden when there is no best-price target in the DOM', () => {
    // No target; but we still render — a getElementById lookup happens against
    // the default best block id. Ensure it is absent and the bar stays hidden.
    const observer = installObserver();
    render(<StickyCta price={PRICE} store="BookClub" href="https://book-club.ua/x" />);
    const bar = screen.getByRole('region', { name: 'Купити книгу — найкраща ціна' });
    expect(bar.getAttribute('data-visible')).toBe('false');
    // No callback should have been captured since there was no element to observe.
    expect(() => observer.fire(false, -500)).not.toThrow();
  });
});
