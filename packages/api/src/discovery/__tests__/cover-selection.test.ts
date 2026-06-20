import { describe, it, expect } from 'vitest';
import { selectCoverUrl, COVER_PROVIDER_PRIORITY } from '../cover-selection.js';

describe('selectCoverUrl', () => {
  it('respects provider priority: yakaboo wins over vivat and book-ye', () => {
    const result = selectCoverUrl([
      { provider: 'book-ye', coverUrl: 'https://book-ye/cover.jpg' },
      { provider: 'vivat', coverUrl: 'https://vivat/cover.jpg' },
      { provider: 'yakaboo', coverUrl: 'https://yakaboo/cover.jpg' },
    ]);
    expect(result).toBe('https://yakaboo/cover.jpg');
  });

  it('respects provider priority: vivat wins over book-ye when yakaboo absent', () => {
    const result = selectCoverUrl([
      { provider: 'book-ye', coverUrl: 'https://book-ye/cover.jpg' },
      { provider: 'vivat', coverUrl: 'https://vivat/cover.jpg' },
    ]);
    expect(result).toBe('https://vivat/cover.jpg');
  });

  it('skips a higher-priority provider with no cover and selects the next non-empty one', () => {
    const result = selectCoverUrl([
      { provider: 'yakaboo', coverUrl: null },
      { provider: 'vivat', coverUrl: 'https://vivat/cover.jpg' },
      { provider: 'book-ye', coverUrl: 'https://book-ye/cover.jpg' },
    ]);
    expect(result).toBe('https://vivat/cover.jpg');
  });

  it('treats an empty / whitespace-only cover as no cover', () => {
    const result = selectCoverUrl([
      { provider: 'yakaboo', coverUrl: '   ' },
      { provider: 'vivat', coverUrl: '' },
      { provider: 'book-ye', coverUrl: 'https://book-ye/cover.jpg' },
    ]);
    expect(result).toBe('https://book-ye/cover.jpg');
  });

  it('trims the selected cover URL', () => {
    const result = selectCoverUrl([{ provider: 'yakaboo', coverUrl: '  https://yakaboo/cover.jpg  ' }]);
    expect(result).toBe('https://yakaboo/cover.jpg');
  });

  it('uses ascending price as a deterministic tiebreak within the same provider', () => {
    const result = selectCoverUrl([
      { provider: 'yakaboo', coverUrl: 'https://yakaboo/expensive.jpg', priceAmount: 50000 },
      { provider: 'yakaboo', coverUrl: 'https://yakaboo/cheap.jpg', priceAmount: 30000 },
    ]);
    expect(result).toBe('https://yakaboo/cheap.jpg');
  });

  it('returns null when every candidate has no cover', () => {
    const result = selectCoverUrl([
      { provider: 'yakaboo', coverUrl: null },
      { provider: 'vivat', coverUrl: undefined },
      { provider: 'book-ye', coverUrl: '' },
    ]);
    expect(result).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(selectCoverUrl([])).toBeNull();
  });

  it('is deterministic regardless of input order', () => {
    const candidates = [
      { provider: 'book-ye' as const, coverUrl: 'https://book-ye/cover.jpg' },
      { provider: 'yakaboo' as const, coverUrl: 'https://yakaboo/cover.jpg' },
      { provider: 'vivat' as const, coverUrl: 'https://vivat/cover.jpg' },
    ];
    const a = selectCoverUrl(candidates);
    const b = selectCoverUrl([...candidates].reverse());
    expect(a).toBe('https://yakaboo/cover.jpg');
    expect(b).toBe('https://yakaboo/cover.jpg');
  });

  it('exposes the fixed provider priority order', () => {
    expect(COVER_PROVIDER_PRIORITY).toEqual(['yakaboo', 'vivat', 'book-ye']);
  });
});
