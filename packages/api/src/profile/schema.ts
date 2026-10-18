import { z } from 'zod';
import { parseOrThrow } from '../http/parse.js';

/**
 * `PATCH /api/profile` body.
 * `displayName` may be a non-empty string (≤40 chars), an empty/whitespace string
 * (normalised to null), or explicitly null (clears the field).
 */
const displayNameSchema = z
  .string()
  .refine((s) => s.trim().length <= 40, { message: 'Ім\'я задовге — максимум 40 символів.' })
  .transform((s): string | null => {
    const trimmed = s.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const updateProfileBody = z.object({
  displayName: z.union([displayNameSchema, z.null()]).optional(),
});

export function parseUpdateProfileBody(input: unknown): { displayName: string | null } {
  const { displayName } = parseOrThrow(updateProfileBody, input, 'Invalid request body');
  return { displayName: displayName !== undefined ? displayName : null };
}
