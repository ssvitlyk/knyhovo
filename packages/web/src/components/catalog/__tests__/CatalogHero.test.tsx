import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CatalogHero } from '../CatalogHero';

describe('CatalogHero', () => {
  it('renders the frozen eyebrow, headline and sub', () => {
    render(<CatalogHero />);
    expect(screen.getByText(/Добірки/)).toBeTruthy();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain('Де знайти найкращу книгу?');
    expect(h1.textContent).toContain('Knyhovo знає');
    expect(screen.getByText(/найдешевші ціни з 5 книгарень/)).toBeTruthy();
  });

  it('shows a summed, thousands-grouped curated book count in the eyebrow', () => {
    render(<CatalogHero />);
    // GENRES + DYNAMIC_COLLECTIONS counts sum well past 1000 → grouped display.
    expect(screen.getByText(/\d\s?\d{3}/)).toBeTruthy();
  });
});
