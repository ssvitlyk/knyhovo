import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// Acceptance criterion: an empty section array hides the whole section (Hero is
// always present, so it is not guarded). Mock the content module with empty
// collections and assert each guarded section renders nothing.
vi.mock('../content', () => ({
  searchHref: (q: string) => `/search?q=${encodeURIComponent(q)}`,
  FEATURED: { badge: '', title: '', desc: '', count: 0, coverSeeds: [], href: '/search?q=x' },
  DYNAMIC_COLLECTIONS: [],
  GENRES: [],
  EDITORIAL: [],
  AUTHORS: [],
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DynamicCollections } from '../DynamicCollections';
import { GenreGrid } from '../GenreGrid';
import { EditorialSpotlight } from '../EditorialSpotlight';
import { PopularAuthors } from '../PopularAuthors';

describe('empty sections hide themselves', () => {
  it.each([
    ['DynamicCollections', DynamicCollections],
    ['GenreGrid', GenreGrid],
    ['EditorialSpotlight', EditorialSpotlight],
    ['PopularAuthors', PopularAuthors],
  ] as const)('%s renders nothing when its collection is empty', (_name, Section) => {
    const { container } = render(<Section />);
    expect(container.firstChild).toBeNull();
  });
});
