import { describe, it, expect } from 'vitest';
import { matchOrCreate } from '../match-canonical.js';
import type { RawProviderListing, CanonicalBook } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';

function makeId(s: string): CanonicalBookId {
  return s as CanonicalBookId;
}

function makeListing(overrides: Partial<RawProviderListing> = {}): RawProviderListing {
  return {
    provider: 'yakaboo',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    isbn: null,
    price: { amount: 34900, currency: 'UAH' },
    url: 'https://yakaboo.ua/kobzar',
    availability: 'in-stock',
    ...overrides,
  };
}

function makeCanonical(overrides: Partial<CanonicalBook> = {}): CanonicalBook {
  return {
    id: makeId('book-1'),
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    isbn: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── No candidates → created ────────────────────────────────────────────
describe('no candidates', () => {
  it('returns created when candidates list is empty', () => {
    const result = matchOrCreate(makeListing(), []);
    expect(result.type).toBe('created');
  });
});

// ── ISBN exact match ────────────────────────────────────────────────────
describe('ISBN exact match', () => {
  it('returns matched with canonicalBookId on identical ISBN-13', () => {
    const listing = makeListing({ isbn: '9786177933105' });
    const candidate = makeCanonical({ isbn: '9786177933105' });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
    if (result.type === 'matched') {
      expect(result.canonicalBookId).toBe(candidate.id);
    }
  });
});

// ── ISBN-10 vs ISBN-13 (EC-3) ──────────────────────────────────────────
describe('ISBN-10 vs ISBN-13 (EC-3)', () => {
  it('matches ISBN-10 in listing against ISBN-13 in canonical', () => {
    const listing = makeListing({ isbn: '0596008929' });
    const candidate = makeCanonical({ isbn: '9780596008925' });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });

  it('matches ISBN-13 in listing against ISBN-10 in canonical', () => {
    const listing = makeListing({ isbn: '9780596008925' });
    const candidate = makeCanonical({ isbn: '0596008929' });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });
});

// ── Title + author exact normalized ────────────────────────────────────
describe('exact normalized key match', () => {
  it('returns matched on exact title+author', () => {
    const listing = makeListing({ title: 'Кобзар', author: 'Тарас Шевченко' });
    const candidate = makeCanonical({ title: 'Кобзар', author: 'Тарас Шевченко' });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
    if (result.type === 'matched') {
      expect(result.canonicalBookId).toBe(candidate.id);
    }
  });
});

// ── й vs і in title (EC-2) ────────────────────────────────────────────
describe('й vs і normalization (EC-2)', () => {
  it('matches "й" and "і" conjunction in title', () => {
    const listing = makeListing({ title: 'Пісня льоду й полум\'я', isbn: null });
    const candidate = makeCanonical({ title: 'Пісня льоду і полум\'я', isbn: null });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });
});

// ── Author name order (EC-4) ───────────────────────────────────────────
describe('author name order (EC-4)', () => {
  it('matches "Firstname Lastname" vs "Lastname Firstname"', () => {
    const listing = makeListing({
      title: 'Fata Morgana',
      author: 'Коцюбинський Михайло',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Fata Morgana',
      author: 'Михайло Коцюбинський',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });
});

// ── Missing ISBN fuzzy match (EC-6) ───────────────────────────────────
describe('missing ISBN fuzzy match (EC-6)', () => {
  it('fuzzy matches when listing has no ISBN', () => {
    const listing = makeListing({
      title: 'Майстер і Маргарита',
      author: 'Михайло Булгаков',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Майстер і Маргарита',
      author: 'Михайло Булгаков',
      isbn: '9789661763080',
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });

  it('fuzzy matches when candidate has no ISBN', () => {
    const listing = makeListing({
      title: 'Майстер і Маргарита',
      author: 'Михайло Булгаков',
      isbn: '9789661763080',
    });
    const candidate = makeCanonical({
      title: 'Майстер і Маргарита',
      author: 'Михайло Булгаков',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });
});

// ── суперобкладинка vs basic edition (EC-7) ──────────────────────────
describe('суперобкладинка stripping (EC-7)', () => {
  it('matches edition with "(суперобкладинка)" to basic edition', () => {
    const listing = makeListing({
      title: 'Гаррі Поттер і Філософський Камінь (суперобкладинка)',
      author: 'Джоан Роулінг',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Гаррі Поттер і Філософський Камінь',
      author: 'Джоан Роулінг',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });
});

// ── VOLUME_MISMATCH conflict ───────────────────────────────────────────
describe('volume mismatch → VOLUME_MISMATCH conflict', () => {
  it('returns conflict with reason VOLUME_MISMATCH when volumes differ', () => {
    const listing = makeListing({
      title: 'Пісня льоду й полум\'я. Книга 1',
      author: 'Джордж Мартін',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Пісня льоду й полум\'я. Книга 2',
      author: 'Джордж Мартін',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('conflict');
    if (result.type === 'conflict') {
      expect(result.reason).toBe('VOLUME_MISMATCH');
    }
  });

  it('does not match volume 1 to volume 2', () => {
    const listing = makeListing({
      title: 'Відьмак. Том 1. Останнє Бажання',
      author: 'Анджей Сапковський',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Відьмак. Том 2. Меч Призначення',
      author: 'Анджей Сапковський',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('conflict');
    if (result.type === 'conflict') {
      expect(result.reason).toBe('VOLUME_MISMATCH');
    }
  });
});

// ── ISBN_CONFLICT conflict ─────────────────────────────────────────────
describe('ISBN mismatch → ISBN_CONFLICT conflict', () => {
  it('returns conflict with reason ISBN_CONFLICT when both have different ISBNs', () => {
    const listing = makeListing({ isbn: '9786177933105' });
    const candidate = makeCanonical({ isbn: '9780596008925' });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('conflict');
    if (result.type === 'conflict') {
      expect(result.reason).toBe('ISBN_CONFLICT');
    }
  });

  it('does NOT return matched on ISBN conflict', () => {
    const listing = makeListing({ isbn: '9786177933105' });
    const candidate = makeCanonical({ isbn: '9780596008925' });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).not.toBe('matched');
  });

  it('ISBN_CONFLICT takes priority over VOLUME_MISMATCH when both are present', () => {
    const listing = makeListing({
      isbn: '9786177933105',
      title: 'Серія. Книга 1',
      author: 'Автор',
    });
    const isbnCandidate = makeCanonical({
      id: makeId('book-isbn'),
      isbn: '9780596008925',
      title: 'Серія. Книга 1',
      author: 'Автор',
    });
    const volCandidate = makeCanonical({
      id: makeId('book-vol'),
      isbn: null,
      title: 'Серія. Книга 2',
      author: 'Автор',
    });
    const result = matchOrCreate(listing, [isbnCandidate, volCandidate]);
    expect(result.type).toBe('conflict');
    if (result.type === 'conflict') {
      expect(result.reason).toBe('ISBN_CONFLICT');
    }
  });
});

// ── BUNDLE_MISMATCH conflict ───────────────────────────────────────────
describe('bundle vs single → BUNDLE_MISMATCH conflict', () => {
  it('returns conflict with reason BUNDLE_MISMATCH for bundle vs single book', () => {
    const listing = makeListing({
      title: 'Гаррі Поттер: комплект 3 книги',
      author: 'Джоан Роулінг',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Гаррі Поттер і Філософський Камінь',
      author: 'Джоан Роулінг',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('conflict');
    if (result.type === 'conflict') {
      expect(result.reason).toBe('BUNDLE_MISMATCH');
    }
  });

  it('returns conflict with reason BUNDLE_MISMATCH for набір', () => {
    const listing = makeListing({
      title: 'Відьмак: набір 3 книги',
      author: 'Анджей Сапковський',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Відьмак. Останнє Бажання',
      author: 'Анджей Сапковський',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('conflict');
    if (result.type === 'conflict') {
      expect(result.reason).toBe('BUNDLE_MISMATCH');
    }
  });
});

// ── No false positive on author match only ─────────────────────────────
describe('no false positive on author match only', () => {
  it('returns created when titles are very different despite same author', () => {
    const listing = makeListing({
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Гайдамаки',
      author: 'Тарас Шевченко',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('created');
  });
});

// ── Missing author edge cases ──────────────────────────────────────────
describe('missing author with high title similarity', () => {
  it('returns matched when listing has no author and title sim >= 0.92', () => {
    const listing = makeListing({
      title: 'Гаррі Поттер і Філософський Камінь',
      author: null,
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Гаррі Поттер і Філософський Камінь',
      author: 'Джоан Роулінг',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).toBe('matched');
  });

  it('does not match when listing has no author and title sim < 0.92', () => {
    const listing = makeListing({
      title: 'Поттер',
      author: null,
      isbn: null,
    });
    const candidate = makeCanonical({
      title: 'Гаррі Поттер і Таємна Кімната',
      author: 'Джоан Роулінг',
      isbn: null,
    });
    const result = matchOrCreate(listing, [candidate]);
    expect(result.type).not.toBe('matched');
  });
});

// ── Conflict beats create when no match ───────────────────────────────
describe('conflict precedence over created', () => {
  it('returns conflict (not created) when a hard conflict was detected even with no match', () => {
    const listing = makeListing({
      isbn: '9786177933105',
      title: 'Різна Книга',
      author: 'Різний Автор',
    });
    const candidate = makeCanonical({
      isbn: '9780596008925',
      title: 'Інша Книга',
      author: 'Інший Автор',
    });
    const result = matchOrCreate(listing, [candidate]);
    // ISBN conflict is detected even though titles/authors differ completely
    expect(result.type).toBe('conflict');
    if (result.type === 'conflict') {
      expect(result.reason).toBe('ISBN_CONFLICT');
    }
  });
});
