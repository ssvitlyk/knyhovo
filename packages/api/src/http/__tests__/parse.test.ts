import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseOrThrow } from '../parse.js';
import { ValidationError } from '../../errors.js';

const schema = z.object({
  n: z.coerce.number().int().min(1).default(3),
  nested: z.object({ id: z.string().uuid() }).optional(),
});

describe('parseOrThrow', () => {
  it('returns parsed data (with defaults/coercion)', () => {
    expect(parseOrThrow(schema, { n: '5' }, 'bad')).toEqual({ n: 5 });
    expect(parseOrThrow(schema, {}, 'bad')).toEqual({ n: 3 });
  });

  it('throws ValidationError with "path: message" for the first issue', () => {
    try {
      parseOrThrow(schema, { n: 0 }, 'bad');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).message).toMatch(/^n: /);
    }
  });

  it('joins nested paths with dots', () => {
    expect(() => parseOrThrow(schema, { nested: { id: 'x' } }, 'bad')).toThrow(/^nested\.id: /);
  });

  it('omits the prefix when the issue has no path', () => {
    expect(() => parseOrThrow(schema, 'not an object', 'bad')).toThrow(ValidationError);
    const msg = (() => {
      try {
        parseOrThrow(schema, 'not an object', 'bad');
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    })();
    expect(msg).not.toMatch(/^: /);
    expect(msg.length).toBeGreaterThan(0);
  });

  it('uses the fallback message when zod reports no issues', () => {
    const noIssues = {
      safeParse: () => ({ success: false, error: { issues: [] } }),
    } as unknown as z.ZodType;
    expect(() => parseOrThrow(noIssues, {}, 'fallback msg')).toThrow('fallback msg');
  });
});
