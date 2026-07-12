import { describe, expect, it } from 'vitest';
import { CANONICAL_GENRES } from '../taxonomy.js';

/**
 * `slug` is a live URL contract (`/zhanry/<slug>`, PRD §6.4). This exact list
 * is frozen so an accidental rename/reorder/removal fails loudly here rather
 * than silently breaking a production URL.
 */
const FROZEN_SLUGS = [
  'fantastyka',
  'fentezi',
  'tryllery',
  'detektyvy',
  'zhahy',
  'young-adult',
  'klasyka',
  'romantyka',
  'samorozvytok',
  'psykholohiia',
  'biznes',
  'biohrafii',
  'dytiachi',
  'komiksy',
  'istoriia',
  'naukovo-populiarni',
  'khudozhnia-proza',
];

describe('CANONICAL_GENRES', () => {
  it('has exactly 17 genres', () => {
    expect(CANONICAL_GENRES).toHaveLength(17);
  });

  it('freezes the exact slug list and order (live URL contract)', () => {
    expect(CANONICAL_GENRES.map((g) => g.slug)).toEqual(FROZEN_SLUGS);
  });

  it('has unique slugs', () => {
    const slugs = CANONICAL_GENRES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has unique keys', () => {
    const keys = CANONICAL_GENRES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every genre a non-empty alias array', () => {
    for (const genre of CANONICAL_GENRES) {
      expect(genre.aliases.length).toBeGreaterThan(0);
    }
  });

  it('gives every genre a non-empty name, description, and icon', () => {
    for (const genre of CANONICAL_GENRES) {
      expect(genre.name.trim().length).toBeGreaterThan(0);
      expect(genre.description.trim().length).toBeGreaterThan(0);
      expect(genre.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('has strictly increasing displayOrder starting at 1', () => {
    const orders = CANONICAL_GENRES.map((g) => g.displayOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(orders[0]).toBe(1);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
