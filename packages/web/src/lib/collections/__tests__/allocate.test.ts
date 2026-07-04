import { describe, expect, it } from 'vitest';
import { allocate } from '../allocate';

const item = (id: string): { id: string } => ({ id });

describe('allocate', () => {
  it('gives every book to exactly one shelf, in priority order', () => {
    const shared = item('shared');
    const out = allocate([
      { key: 'first', take: 2, pool: [shared, item('a')] },
      { key: 'second', take: 2, pool: [shared, item('b'), item('c')] },
    ]);

    expect(out.first.map((i) => i.id)).toEqual(['shared', 'a']);
    expect(out.second.map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('respects the take limit', () => {
    const out = allocate([{ key: 'k', take: 2, pool: [item('a'), item('b'), item('c')] }]);
    expect(out.k).toHaveLength(2);
  });

  it('returns fewer items when the pool is exhausted by earlier shelves', () => {
    const a = item('a');
    const out = allocate([
      { key: 'first', take: 1, pool: [a] },
      { key: 'second', take: 3, pool: [a] },
    ]);
    expect(out.second).toEqual([]);
  });

  it('handles empty specs and empty pools', () => {
    expect(allocate([])).toEqual({});
    expect(allocate([{ key: 'k', take: 3, pool: [] }])).toEqual({ k: [] });
  });
});
