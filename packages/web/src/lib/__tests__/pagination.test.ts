import { describe, expect, it } from 'vitest';
import { getPageItems, PAGINATION_ELLIPSIS } from '../pagination';

const E = PAGINATION_ELLIPSIS;

describe('getPageItems (frozen pagination algorithm)', () => {
  it('shows every page without ellipsis when total ≤ 7', () => {
    expect(getPageItems(1, 1)).toEqual([1]);
    expect(getPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('shows first + last + current ±1 with a trailing ellipsis near the start', () => {
    expect(getPageItems(4, 24)).toEqual([1, 2, 3, 4, 5, E, 24]);
  });

  it('places ellipses on both sides in the middle', () => {
    expect(getPageItems(12, 24)).toEqual([1, E, 11, 12, 13, E, 24]);
  });

  it('fills a single hidden page instead of using an ellipsis', () => {
    expect(getPageItems(22, 25)).toEqual([1, E, 21, 22, 23, 24, 25]);
  });

  it('handles very large page counts', () => {
    expect(getPageItems(2323, 5000)).toEqual([1, E, 2322, 2323, 2324, E, 5000]);
  });
});
