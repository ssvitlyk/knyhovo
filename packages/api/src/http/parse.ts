import type { z } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Parse `input` with `schema` at the API boundary. On failure throws a
 * {@link ValidationError} (→ HTTP 400) whose message is the first zod issue,
 * prefixed with its dotted path when it has one (`path: message`). When zod
 * reports no issue at all, `fallbackMessage` is used instead.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown,
  fallbackMessage: string,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : fallbackMessage;
    throw new ValidationError(message);
  }
  return result.data;
}
