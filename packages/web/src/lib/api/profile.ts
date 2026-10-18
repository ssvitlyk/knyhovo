import { apiJson, defineApiError } from './http';
import type { AuthUserDto } from './types';

/** Error thrown when a profile request fails (network, timeout, or non-2xx). */
export class ProfileError extends defineApiError('ProfileError') {}

/**
 * Update the authenticated user's profile (browser-side).
 * Uses a relative URL so the Next.js `/api/*` rewrite proxies the request.
 * Throws {@link ProfileError} on non-2xx or transport/timeout failures.
 */
export async function updateProfile(body: {
  displayName: string | null;
}): Promise<AuthUserDto> {
  return apiJson<AuthUserDto>('/api/profile', {
    method: 'PATCH',
    credentials: 'include',
    body,
    errorClass: ProfileError,
    transportMessage: 'Не вдалося оновити профіль.',
    httpMessage: (status) => `Не вдалося оновити профіль (${status}).`,
  });
}
