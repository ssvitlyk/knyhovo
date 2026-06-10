import { describe, it, expect } from 'vitest';
import { parseBookParams } from '../schema.js';
import { BadRequestError } from '../../errors.js';

describe('parseBookParams', () => {
  it('parses a valid UUID', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    expect(parseBookParams({ id: uuid })).toEqual({ id: uuid });
  });

  it.each([
    ['non-uuid string', { id: 'not-a-uuid' }],
    ['empty string', { id: '' }],
    ['numeric string', { id: '12345' }],
    ['truncated uuid', { id: '11111111-1111-4111-8111' }],
  ])('throws BadRequestError for %s', (_label, input) => {
    expect(() => parseBookParams(input)).toThrow(BadRequestError);
  });
});
