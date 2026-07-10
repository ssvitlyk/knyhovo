import { describe, it, expect } from 'vitest';
import { selectBookMetadata, METADATA_PROVIDER_PRIORITY } from '../metadata-selection.js';

describe('selectBookMetadata', () => {
  it('respects provider priority: yakaboo wins over vivat and book-ye', () => {
    const result = selectBookMetadata([
      { provider: 'book-ye', publisher: 'book-ye publisher' },
      { provider: 'vivat', publisher: 'vivat publisher' },
      { provider: 'yakaboo', publisher: 'yakaboo publisher' },
    ]);
    expect(result.publisher).toBe('yakaboo publisher');
  });

  it('respects provider priority: vivat wins over book-ye when yakaboo absent', () => {
    const result = selectBookMetadata([
      { provider: 'book-ye', publisher: 'book-ye publisher' },
      { provider: 'vivat', publisher: 'vivat publisher' },
    ]);
    expect(result.publisher).toBe('vivat publisher');
  });

  it('skips a higher-priority provider with no value for that field', () => {
    const result = selectBookMetadata([
      { provider: 'yakaboo', publisher: null },
      { provider: 'vivat', publisher: 'vivat publisher' },
      { provider: 'book-ye', publisher: 'book-ye publisher' },
    ]);
    expect(result.publisher).toBe('vivat publisher');
  });

  it('treats an empty / whitespace-only string as no value', () => {
    const result = selectBookMetadata([
      { provider: 'yakaboo', publisher: '   ' },
      { provider: 'vivat', publisher: '' },
      { provider: 'book-ye', publisher: 'book-ye publisher' },
    ]);
    expect(result.publisher).toBe('book-ye publisher');
  });

  it('trims the selected string value', () => {
    const result = selectBookMetadata([{ provider: 'yakaboo', series: '  Серія із пробілами  ' }]);
    expect(result.series).toBe('Серія із пробілами');
  });

  it('uses ascending price as a deterministic tiebreak within the same provider', () => {
    const result = selectBookMetadata([
      { provider: 'yakaboo', publisher: 'дорожчий', priceAmount: 50000 },
      { provider: 'yakaboo', publisher: 'дешевший', priceAmount: 30000 },
    ]);
    expect(result.publisher).toBe('дешевший');
  });

  it('selects each field independently across different providers', () => {
    const result = selectBookMetadata([
      { provider: 'vivat', publisher: 'Vivat', language: 'Українська', format: 'Тверда', series: 'Навіки Токіо', publicationYear: 2023 },
      { provider: 'yakaboo', publisher: null, language: null, format: 'М\'яка', series: null, publicationYear: null },
    ]);
    // yakaboo has higher priority but no publisher/language/series/year — falls back to vivat per-field.
    expect(result).toEqual({
      publisher: 'Vivat',
      language: 'Українська',
      // yakaboo has higher priority AND a usable format value — wins for that field only.
      format: "М'яка",
      series: 'Навіки Токіо',
      publicationYear: 2023,
    });
  });

  it('returns all nulls when no candidate has any metadata', () => {
    const result = selectBookMetadata([
      { provider: 'yakaboo' },
      { provider: 'vivat', publisher: null, language: undefined },
      { provider: 'book-ye' },
    ]);
    expect(result).toEqual({
      publisher: null,
      language: null,
      format: null,
      series: null,
      publicationYear: null,
    });
  });

  it('returns all nulls for an empty candidate list', () => {
    expect(selectBookMetadata([])).toEqual({
      publisher: null,
      language: null,
      format: null,
      series: null,
      publicationYear: null,
    });
  });

  it('is deterministic regardless of input order', () => {
    const candidates = [
      { provider: 'book-ye' as const, publisher: 'book-ye publisher' },
      { provider: 'yakaboo' as const, publisher: 'yakaboo publisher' },
      { provider: 'vivat' as const, publisher: 'vivat publisher' },
    ];
    const a = selectBookMetadata(candidates);
    const b = selectBookMetadata([...candidates].reverse());
    expect(a.publisher).toBe('yakaboo publisher');
    expect(b.publisher).toBe('yakaboo publisher');
  });

  it('exposes the fixed provider priority order matching covers/description', () => {
    expect(METADATA_PROVIDER_PRIORITY).toEqual(['yakaboo', 'vivat', 'book-ye']);
  });
});
