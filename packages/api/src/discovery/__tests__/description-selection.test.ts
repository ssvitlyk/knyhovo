import { describe, it, expect } from 'vitest';
import { selectDescription, DESCRIPTION_PROVIDER_PRIORITY } from '../description-selection.js';

describe('selectDescription', () => {
  it('respects provider priority: yakaboo wins over vivat and book-ye', () => {
    const result = selectDescription([
      { provider: 'book-ye', description: 'book-ye опис' },
      { provider: 'vivat', description: 'vivat опис' },
      { provider: 'yakaboo', description: 'yakaboo опис' },
    ]);
    expect(result).toBe('yakaboo опис');
  });

  it('respects provider priority: vivat wins over book-ye when yakaboo absent', () => {
    const result = selectDescription([
      { provider: 'book-ye', description: 'book-ye опис' },
      { provider: 'vivat', description: 'vivat опис' },
    ]);
    expect(result).toBe('vivat опис');
  });

  it('skips a higher-priority provider with no description and selects the next non-empty one', () => {
    const result = selectDescription([
      { provider: 'yakaboo', description: null },
      { provider: 'vivat', description: 'vivat опис' },
      { provider: 'book-ye', description: 'book-ye опис' },
    ]);
    expect(result).toBe('vivat опис');
  });

  it('treats an empty / whitespace-only description as no description', () => {
    const result = selectDescription([
      { provider: 'yakaboo', description: '   ' },
      { provider: 'vivat', description: '' },
      { provider: 'book-ye', description: 'book-ye опис' },
    ]);
    expect(result).toBe('book-ye опис');
  });

  it('trims the selected description', () => {
    const result = selectDescription([{ provider: 'yakaboo', description: '  опис із пробілами  ' }]);
    expect(result).toBe('опис із пробілами');
  });

  it('uses ascending price as a deterministic tiebreak within the same provider', () => {
    const result = selectDescription([
      { provider: 'yakaboo', description: 'дорожчий', priceAmount: 50000 },
      { provider: 'yakaboo', description: 'дешевший', priceAmount: 30000 },
    ]);
    expect(result).toBe('дешевший');
  });

  it('returns null when every candidate has no description', () => {
    const result = selectDescription([
      { provider: 'yakaboo', description: null },
      { provider: 'vivat', description: undefined },
      { provider: 'book-ye', description: '' },
    ]);
    expect(result).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(selectDescription([])).toBeNull();
  });

  it('is deterministic regardless of input order', () => {
    const candidates = [
      { provider: 'book-ye' as const, description: 'book-ye опис' },
      { provider: 'yakaboo' as const, description: 'yakaboo опис' },
      { provider: 'vivat' as const, description: 'vivat опис' },
    ];
    const a = selectDescription(candidates);
    const b = selectDescription([...candidates].reverse());
    expect(a).toBe('yakaboo опис');
    expect(b).toBe('yakaboo опис');
  });

  it('exposes the fixed provider priority order matching covers', () => {
    expect(DESCRIPTION_PROVIDER_PRIORITY).toEqual(['yakaboo', 'vivat', 'book-ye']);
  });
});
