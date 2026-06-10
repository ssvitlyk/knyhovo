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
});
