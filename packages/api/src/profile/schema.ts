import { z } from 'zod';
import { ValidationError } from '../errors.js';

function firstIssueMessage(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const path = issue.path.join('.');
  return `${path ? `${path}: ` : ''}${issue.message}`;
}

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

export type UpdateProfileBody = { displayName: string | null };

export function parseUpdateProfileBody(input: unknown): UpdateProfileBody {
  const result = updateProfileBody.safeParse(input);
  if (!result.success) throw new ValidationError(firstIssueMessage(result.error, 'Invalid request body'));
  const displayName = result.data.displayName;
  return { displayName: displayName !== undefined ? displayName : null };
}
