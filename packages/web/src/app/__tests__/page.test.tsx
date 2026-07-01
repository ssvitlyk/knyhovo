import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import HomePage from '../page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('HomePage', () => {
  it('renders the four frozen sections in order: Hero → Популярне → Новинки → Knyhovo радить', () => {
    const { container } = render(<HomePage />);
    const headings = Array.from(container.querySelectorAll('h1, h2')).map((h) => h.textContent ?? '');
    expect(headings[0]).toContain('Де книга дешевша?');
    expect(headings[1]).toBe('Популярне зараз');
    expect(headings[2]).toBe('Новинки');
    expect(headings[3]).toBe('Книговик радить');
  });

  it('advertises the WebSite + SearchAction JSON-LD (search entry point)', () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('WebSite');
    expect(data.potentialAction['@type']).toBe('SearchAction');
    expect(data.potentialAction.target.urlTemplate).toContain('/search?q={search_term_string}');
  });
});
