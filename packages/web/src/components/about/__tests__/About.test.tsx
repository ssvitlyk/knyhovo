import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutHero } from '../AboutHero';
import { HowItWorks } from '../HowItWorks';
import { WhyKnyhovo } from '../WhyKnyhovo';
import { Features } from '../Features';
import { EndCta } from '../EndCta';

describe('About sections (smoke)', () => {
  it('AboutHero renders the H1', () => {
    render(<AboutHero />);
    expect(screen.getByRole('heading', { level: 1, name: /Купуйте книги\s+у правильний момент\s*\./ })).toBeTruthy();
  });

  it('HowItWorks renders the 4-step heading', () => {
    render(<HowItWorks />);
    expect(screen.getByRole('heading', { level: 2, name: 'Як працює Knyhovo' })).toBeTruthy();
  });

  it('WhyKnyhovo renders the advantages heading', () => {
    render(<WhyKnyhovo />);
    expect(screen.getByRole('heading', { level: 2, name: 'Чому користуються Knyhovo' })).toBeTruthy();
  });

  it('Features (guest): auth-required cards route through /login?returnTo=…', () => {
    render(<Features authenticated={false} />);
    expect(screen.getByRole('link', { name: /Бажанки/ })).toHaveProperty(
      'href',
      expect.stringContaining('/login?returnTo=%2Fwishlist'),
    );
    expect(screen.getByRole('link', { name: /Email-сповіщення/ })).toHaveProperty(
      'href',
      expect.stringContaining('/login?returnTo=%2Fsettings%2Fnotifications'),
    );
  });

  it('Features (authenticated): auth-required cards go straight to destination', () => {
    render(<Features authenticated />);
    expect(screen.getByRole('link', { name: /Бажанки/ })).toHaveProperty('href', expect.stringContaining('/wishlist'));
    expect(screen.getByRole('link', { name: /Email-сповіщення/ })).toHaveProperty(
      'href',
      expect.stringContaining('/settings/notifications'),
    );
  });

  it('Features: «Порівняння цін» and «Історія цін» both link to /search', () => {
    render(<Features authenticated={false} />);
    expect(screen.getByRole('link', { name: /Порівняння цін/ })).toHaveProperty('href', expect.stringContaining('/search'));
    expect(screen.getByRole('link', { name: /Історія цін/ })).toHaveProperty('href', expect.stringContaining('/search'));
  });

  it('Features: exactly 4 cards, each a single link with no nested anchors', () => {
    const { container } = render(<Features authenticated={false} />);
    const cards = container.querySelectorAll('.ab-fcard');
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      // the whole card IS the anchor, and it contains no inner anchor
      expect(card.tagName).toBe('A');
      expect(card.querySelectorAll('a')).toHaveLength(0);
    });
    // every card shows a visual CTA span (not a separate link)
    expect(container.querySelectorAll('.ab-fcard__cta')).toHaveLength(4);
    expect(container.querySelectorAll('.ab-fcard__cta a')).toHaveLength(0);
    // vignettes stay decorative
    expect(container.querySelectorAll('.ab-fcard__viz [aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('EndCta renders CTA link to /', () => {
    render(<EndCta />);
    const link = screen.getByRole('link', { name: /Почати пошук/ });
    expect(link).toHaveProperty('href', expect.stringContaining('/'));
  });
});
