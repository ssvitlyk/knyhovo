import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookCard } from '../BookCard';
import { Badge } from '../Badge';

describe('BookCard', () => {
  it('renders title, author, price and store', () => {
    render(<BookCard title="Кобзар" author="Тарас Шевченко" price="299 ₴" store="Yakaboo" />);
    expect(screen.getByRole('heading', { name: 'Кобзар' })).toBeInTheDocument();
    expect(screen.getByText('Тарас Шевченко')).toBeInTheDocument();
    expect(screen.getByText('299 ₴')).toBeInTheDocument();
    expect(screen.getByText('· Yakaboo')).toBeInTheDocument();
  });

  it('shows a muted offers note only when there is more than one offer', () => {
    const { rerender } = render(<BookCard title="A" author="B" price="10 ₴" store="Yakaboo" offersCount={1} />);
    expect(screen.queryByText(/ще/)).not.toBeInTheDocument();

    rerender(<BookCard title="A" author="B" price="10 ₴" store="Yakaboo" offersCount={3} />);
    expect(screen.getByText('· ще 2')).toBeInTheDocument();
  });

  it('renders a badge when provided', () => {
    render(
      <BookCard
        title="A"
        author="B"
        price="10 ₴"
        store="Yakaboo"
        badge={<Badge tone="green">Найкраща ціна</Badge>}
      />,
    );
    expect(screen.getByText('Найкраща ціна')).toBeInTheDocument();
  });

  it('renders the cover image when a cover URL is provided', () => {
    const { container } = render(
      <BookCard title="A" author="B" price="10 ₴" cover="https://img/cover.jpg" />,
    );
    const img = container.querySelector('img.kn-book__cover');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://img/cover.jpg');
  });

  it('falls back to the placeholder (no img) when cover is null', () => {
    const { container } = render(
      <BookCard title="A" author="B" price="10 ₴" cover={null} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.kn-book__cover')).not.toBeNull();
  });
});
