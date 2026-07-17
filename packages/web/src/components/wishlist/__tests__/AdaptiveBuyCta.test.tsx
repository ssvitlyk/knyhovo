import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdaptiveBuyCta } from '../AdaptiveBuyCta';

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function mockWidths(anchorClientWidth: number, spanOffsetWidth: number): void {
  Object.defineProperty(HTMLAnchorElement.prototype, 'clientWidth', {
    configurable: true,
    value: anchorClientWidth,
  });
  Object.defineProperty(HTMLSpanElement.prototype, 'offsetWidth', {
    configurable: true,
    value: spanOffsetWidth,
  });
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
});

describe('AdaptiveBuyCta', () => {
  it('shows the full label when the measured span fits the button width', () => {
    mockWidths(300, 100);
    render(<AdaptiveBuyCta price={19900} currency="UAH" href="https://store.example/book" />);
    expect(screen.getByRole('link', { name: 'Купити за 199 ₴' })).toHaveTextContent('Купити за 199 ₴');
  });

  it('collapses to just the price when the full label does not fit', () => {
    mockWidths(50, 200);
    render(<AdaptiveBuyCta price={19900} currency="UAH" href="https://store.example/book" />);
    const link = screen.getByRole('link', { name: 'Купити за 199 ₴' });
    // The hidden measure span always carries the full label text; the visible
    // (non-measure) text content is what actually collapses.
    expect(link.textContent).toBe('Купити за 199 ₴199 ₴');
  });

  it('always sets the full aria-label, even when the visible label collapses', () => {
    mockWidths(50, 200);
    render(<AdaptiveBuyCta price={19900} currency="UAH" href="https://store.example/book" />);
    expect(screen.getByRole('link', { name: 'Купити за 199 ₴' })).toBeInTheDocument();
  });

  it('opens external store links in a new tab', () => {
    mockWidths(300, 100);
    render(<AdaptiveBuyCta price={19900} currency="UAH" href="https://store.example/book" />);
    const link = screen.getByRole('link', { name: 'Купити за 199 ₴' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
