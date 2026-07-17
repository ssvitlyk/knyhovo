import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { KnyhovykStatus } from '@/lib/knyhovyk-status';
import { KnyhovykPick, type KnyhovykPickProps } from '../KnyhovykPick';

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
});

const BASE: Omit<KnyhovykPickProps, 'status'> = {
  bookId: 'atomni',
  title: 'Атомні звички',
  author: 'Джеймс Клір',
  coverUrl: null,
  price: 19900,
  prevPrice: 24500,
  targetPrice: 21000,
  currency: 'UAH',
  storeDisplayName: 'Yakaboo',
  ctaHref: 'https://yakaboo.ua/atomni-zvychky',
};

function status(kind: KnyhovykStatus['kind'], label: string | null): KnyhovykStatus {
  return { kind, label };
}

describe('KnyhovykPick', () => {
  it('renders a stamp with the deal label «Найбільша знижка»', () => {
    render(<KnyhovykPick {...BASE} status={status('deal', 'Найбільша знижка')} />);
    expect(screen.getAllByLabelText(/Найбільша знижка,/).length).toBeGreaterThan(0);
  });

  it('renders no stamp and the --nostamp class for the none status', () => {
    const { container } = render(<KnyhovykPick {...BASE} status={status('none', null)} />);
    expect(container.querySelector('.wl21-feat__stamp')).not.toBeInTheDocument();
    expect(container.querySelector('.wl21-feat--nostamp')).not.toBeNull();
    expect(container.querySelector('.wl21-featm--nostamp')).not.toBeNull();
  });

  it('overrides the derived message with a curator note', () => {
    render(<KnyhovykPick {...BASE} status={status('goal', 'Ціль досягнута')} note="Куратор радить це." />);
    expect(screen.getAllByText('Куратор радить це.').length).toBeGreaterThan(0);
  });

  it('renders the goal message without the 6-month clause', () => {
    render(<KnyhovykPick {...BASE} status={status('goal', 'Ціль досягнута')} />);
    const messages = screen.getAllByText(/Ви встановили бажану ціну/);
    expect(messages.length).toBeGreaterThan(0);
    for (const el of messages) {
      expect(el.textContent).not.toContain('найнижча ціна за останні 6 місяців');
    }
  });

  it('links «Деталі книги» to /books/:id', () => {
    render(<KnyhovykPick {...BASE} status={status('none', null)} />);
    const links = screen.getAllByRole('link', { name: 'Деталі книги' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/books/atomni');
    }
  });
});
