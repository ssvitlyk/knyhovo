import { describe, expect, it } from 'vitest';
import { buildBookJsonLd, buildBookMetaDescription } from '../book-jsonld';
import type { BookDetailsDto } from '@/lib/api/types';

const SITE = 'https://knyhovo.test';

const FULL_BOOK: BookDetailsDto = {
  id: 'book-1',
  title: 'Тіні забутих предків',
  author: 'Михайло Коцюбинський',
  isbn: '9786171234567',
  description: 'Повість про життя гуцулів у Карпатах.',
  coverUrl: 'https://cdn.test/cover.jpg',
  lowestPrice: { amount: 29900, currency: 'UAH' },
  offersCount: 2,
  providers: [
    {
      provider: 'book-club',
      price: { amount: 29900, currency: 'UAH' },
      availability: 'in-stock',
      url: 'https://book-club.ua/book/1',
      lastSeenAt: '2024-03-10T12:00:00.000Z',
    },
    {
      provider: 'yakaboo',
      price: { amount: 34900, currency: 'UAH' },
      availability: 'out-of-stock',
      url: 'https://yakaboo.ua/book/1',
      lastSeenAt: '2024-03-10T12:00:00.000Z',
    },
  ],
};

describe('buildBookJsonLd', () => {
  it('builds a schema.org Book with author, isbn, image, description and url', () => {
    const jsonLd = buildBookJsonLd(FULL_BOOK, SITE);
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Book');
    expect(jsonLd.name).toBe('Тіні забутих предків');
    expect(jsonLd.author).toEqual({ '@type': 'Person', name: 'Михайло Коцюбинський' });
    expect(jsonLd.isbn).toBe('9786171234567');
    expect(jsonLd.image).toBe('https://cdn.test/cover.jpg');
    expect(jsonLd.description).toBe('Повість про життя гуцулів у Карпатах.');
    expect(jsonLd.url).toBe('https://knyhovo.test/books/book-1');
  });

  it('builds an AggregateOffer with prices in major units and per-provider offers', () => {
    const offers = buildBookJsonLd(FULL_BOOK, SITE).offers as Record<string, unknown>;
    expect(offers['@type']).toBe('AggregateOffer');
    expect(offers.priceCurrency).toBe('UAH');
    expect(offers.lowPrice).toBe(299);
    expect(offers.highPrice).toBe(349);
    expect(offers.offerCount).toBe(2);

    const list = offers.offers as ReadonlyArray<Record<string, unknown>>;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      '@type': 'Offer',
      price: 299,
      priceCurrency: 'UAH',
      availability: 'https://schema.org/InStock',
      url: 'https://book-club.ua/book/1',
    });
    expect(list[1]!.availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits optional fields and offers when the API has no data', () => {
    const partial: BookDetailsDto = {
      id: 'book-2',
      title: 'Без даних',
      author: 'Невідомий',
      isbn: null,
      description: null,
      coverUrl: null,
      lowestPrice: null,
      offersCount: 0,
      providers: [],
    };
    const jsonLd = buildBookJsonLd(partial, SITE);
    expect(jsonLd).not.toHaveProperty('isbn');
    expect(jsonLd).not.toHaveProperty('image');
    expect(jsonLd).not.toHaveProperty('description');
    expect(jsonLd).not.toHaveProperty('offers');
    expect(jsonLd.name).toBe('Без даних');
  });

  it('maps unknown availability to LimitedAvailability', () => {
    const book: BookDetailsDto = {
      ...FULL_BOOK,
      lowestPrice: null,
      providers: [
        {
          provider: 'yakaboo',
          price: { amount: 25000, currency: 'UAH' },
          availability: 'unknown',
          url: 'https://yakaboo.ua/book/9',
          lastSeenAt: '2024-03-10T12:00:00.000Z',
        },
      ],
    };
    const offers = buildBookJsonLd(book, SITE).offers as Record<string, unknown>;
    // lowPrice falls back to the min provider amount when lowestPrice is null.
    expect(offers.lowPrice).toBe(250);
    const list = offers.offers as ReadonlyArray<Record<string, unknown>>;
    expect(list[0]!.availability).toBe('https://schema.org/LimitedAvailability');
  });
});

describe('buildBookMetaDescription', () => {
  it('uses the collapsed description when short enough', () => {
    expect(buildBookMetaDescription(FULL_BOOK)).toBe('Повість про життя гуцулів у Карпатах.');
  });

  it('truncates a long description with an ellipsis', () => {
    const long = 'а'.repeat(300);
    const result = buildBookMetaDescription({ ...FULL_BOOK, description: long });
    expect(result.length).toBeLessThanOrEqual(155);
    expect(result.endsWith('…')).toBe(true);
  });

  it('falls back to a price-compare line when description is missing', () => {
    const result = buildBookMetaDescription({ ...FULL_BOOK, description: null });
    expect(result).toContain('Тіні забутих предків');
    expect(result).toContain('Михайло Коцюбинський');
  });
});
