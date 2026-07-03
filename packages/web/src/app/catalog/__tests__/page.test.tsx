import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import CatalogPage from '../page';

// next/link → a plain anchor so the page renders deterministically in jsdom.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('CatalogPage', () => {
  it('renders the frozen sections in order: Hero → Dynamic → Genre → Curated → Authors', () => {
    const { container } = render(<CatalogPage />);
    const headings = Array.from(container.querySelectorAll('h1, h2')).map((h) => h.textContent ?? '');
    expect(headings[0]).toContain('Де знайти найкращу книгу?');
    expect(headings[1]).toBe('Щодня оновлюється');
    expect(headings[2]).toBe('За жанром');
    expect(headings[3]).toBe('Curated');
    expect(headings[4]).toBe('Популярні автори');
  });

  it('renders the Featured card and the two section dividers', () => {
    const { container } = render(<CatalogPage />);
    expect(container.querySelector('.feat-card')).toBeTruthy();
    expect(container.querySelectorAll('hr.page-divider')).toHaveLength(2);
  });

  it('advertises CollectionPage + BreadcrumbList JSON-LD', () => {
    const { container } = render(<CatalogPage />);
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    const types = scripts.map((s) => JSON.parse(s.textContent ?? '{}')['@type']);
    expect(types).toContain('CollectionPage');
    expect(types).toContain('BreadcrumbList');

    const breadcrumb = scripts
      .map((s) => JSON.parse(s.textContent ?? '{}'))
      .find((d) => d['@type'] === 'BreadcrumbList');
    const names = breadcrumb.itemListElement.map((i: { name: string }) => i.name);
    expect(names).toEqual(['Головна', 'Каталог']);
  });
});
