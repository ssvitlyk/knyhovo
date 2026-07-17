import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WishlistHero } from '../WishlistHero';

describe('WishlistHero', () => {
  it('renders M із N in the headline', () => {
    render(
      <WishlistHero totalWishlistCount={24} opportunitiesCount={5} totalSavings={0} currency="UAH" />,
    );
    expect(screen.getByText('5 із 24')).toBeInTheDocument();
  });

  it.each([
    [1, 'книга'],
    [2, 'книги'],
    [5, 'книг'],
    [21, 'книга'],
    [22, 'книги'],
  ])('pluralizes %i as %s in the eyebrow', (n, word) => {
    render(<WishlistHero totalWishlistCount={n} opportunitiesCount={0} totalSavings={0} currency="UAH" />);
    expect(screen.getByText(`Бажанки · ${n} ${word} під наглядом`)).toBeInTheDocument();
  });

  it('shows the KPI panel with the formatted sum when savings > 0', () => {
    render(
      <WishlistHero totalWishlistCount={10} opportunitiesCount={3} totalSavings={41200} currency="UAH" />,
    );
    expect(screen.getByText('Разом можна заощадити')).toBeInTheDocument();
    expect(screen.getByText('412 ₴')).toBeInTheDocument();
  });

  it('hides the KPI panel when savings are 0', () => {
    render(
      <WishlistHero totalWishlistCount={10} opportunitiesCount={0} totalSavings={0} currency="UAH" />,
    );
    expect(screen.queryByText('Разом можна заощадити')).not.toBeInTheDocument();
  });

  it('renders the freshness pill', () => {
    render(<WishlistHero totalWishlistCount={1} opportunitiesCount={0} totalSavings={0} currency="UAH" />);
    expect(screen.getByText('Перевірено сьогодні')).toBeInTheDocument();
  });
});
