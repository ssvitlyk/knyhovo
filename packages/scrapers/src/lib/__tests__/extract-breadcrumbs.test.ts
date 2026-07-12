import { describe, it, expect } from 'vitest';
import { extractBreadcrumbs, finalizeRawCategories } from '../extract-breadcrumbs.js';

function ldJson(value: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(value)}</script></head><body></body></html>`;
}

describe('extractBreadcrumbs', () => {
  it('extracts a valid BreadcrumbList, dropping home crumb and matching title', () => {
    const html = ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, item: 'https://example.ua', name: 'Головна' },
        { '@type': 'ListItem', position: 2, name: 'Художня література' },
        { '@type': 'ListItem', position: 3, name: 'Фентезі' },
        { '@type': 'ListItem', position: 4, name: 'Дюна' },
      ],
    });
    expect(extractBreadcrumbs(html, 'Дюна')).toEqual(['Художня література', 'Фентезі']);
  });

  it('handles JSON-LD as a top-level array of objects', () => {
    const html = ldJson([
      { '@type': 'Product', name: 'Дюна' },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { position: 1, name: 'Головна' },
          { position: 2, name: 'Художня література' },
        ],
      },
    ]);
    expect(extractBreadcrumbs(html, 'Дюна')).toEqual(['Художня література']);
  });

  it('sorts by position when items are out of document order', () => {
    const html = ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 3, name: 'Фентезі' },
        { position: 1, name: 'Головна' },
        { position: 2, name: 'Художня література' },
      ],
    });
    expect(extractBreadcrumbs(html)).toEqual(['Художня література', 'Фентезі']);
  });

  it('skips a malformed JSON-LD block and finds a valid one among others', () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not valid json </script>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { position: 1, name: 'Головна' },
          { position: 2, name: 'Художня література' },
        ],
      })}</script>
    </head><body></body></html>`;
    expect(extractBreadcrumbs(html)).toEqual(['Художня література']);
  });

  it('returns [] when only malformed JSON-LD blocks are present', () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not valid json </script>
    </head><body></body></html>`;
    expect(extractBreadcrumbs(html)).toEqual([]);
  });

  it('skips non-object and nameless itemListElement entries without crashing', () => {
    const html = ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [
        'not an object',
        { position: 1, name: 'Головна' },
        { position: 2 },
        { position: 3, name: '   ' },
        { position: 4, name: 'Художня література' },
      ],
    });
    expect(extractBreadcrumbs(html)).toEqual(['Художня література']);
  });

  it('dedupes duplicate crumb names, keeping first occurrence', () => {
    const html = ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Головна' },
        { position: 2, name: 'Художня література' },
        { position: 3, name: 'Художня література' },
      ],
    });
    expect(extractBreadcrumbs(html)).toEqual(['Художня література']);
  });

  it('returns [] when no BreadcrumbList is present at all', () => {
    const html = ldJson({ '@type': 'Product', name: 'Дюна' });
    expect(extractBreadcrumbs(html, 'Дюна')).toEqual([]);
  });

  it('does not drop the last crumb when no title is passed', () => {
    const html = ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Головна' },
        { position: 2, name: 'Художня література' },
        { position: 3, name: 'Дюна' },
      ],
    });
    expect(extractBreadcrumbs(html)).toEqual(['Художня література', 'Дюна']);
  });

  it('keeps the last crumb when title does not match it', () => {
    const html = ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Головна' },
        { position: 2, name: 'Художня література' },
        { position: 3, name: 'Дюна' },
      ],
    });
    expect(extractBreadcrumbs(html, 'Інша назва')).toEqual(['Художня література', 'Дюна']);
  });

  it('reads name from a nested item object, falling back to top-level name', () => {
    const html = ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, item: { '@id': 'https://example.ua', name: 'Головна' } },
        { position: 2, item: 'https://example.ua/fiction', name: 'Художня література' },
      ],
    });
    expect(extractBreadcrumbs(html)).toEqual(['Художня література']);
  });

  it('finds a BreadcrumbList nested inside an @graph container', () => {
    const html = ldJson({
      '@graph': [
        { '@type': 'Product', name: 'Дюна' },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { position: 1, name: 'Головна' },
            { position: 2, name: 'Художня література' },
          ],
        },
      ],
    });
    expect(extractBreadcrumbs(html)).toEqual(['Художня література']);
  });

  it('returns [] when itemListElement is not an array', () => {
    const html = ldJson({ '@type': 'BreadcrumbList', itemListElement: 'not-an-array' });
    expect(extractBreadcrumbs(html)).toEqual([]);
  });
});

describe('finalizeRawCategories', () => {
  it('trims and collapses internal whitespace', () => {
    expect(finalizeRawCategories(['  Художня   \n література  '])).toEqual(['Художня література']);
  });

  it('drops empty/whitespace-only strings', () => {
    expect(finalizeRawCategories(['', '   ', 'Фентезі'])).toEqual(['Фентезі']);
  });

  it('dedupes preserving first-occurrence order', () => {
    expect(finalizeRawCategories(['Фентезі', 'Роман', 'Фентезі'])).toEqual(['Фентезі', 'Роман']);
  });

  it('drops non-string entries', () => {
    expect(finalizeRawCategories([null, undefined, 'Фентезі'])).toEqual(['Фентезі']);
  });
});
