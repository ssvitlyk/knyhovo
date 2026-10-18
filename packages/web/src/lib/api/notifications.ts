import { apiBaseUrl } from './env';
import { apiJson, apiRequest, defineApiError } from './http';
import type { NotificationPreferencesDto } from './types';

/** Error thrown when a notifications request fails (network, timeout, or non-2xx). */
export class NotificationsError extends defineApiError('NotificationsError') {}

/**
 * Fetch the authenticated user's notification preferences (server-side).
 * Returns `{ unauthorized: true }` sentinel on 401.
 * Throws {@link NotificationsError} on other non-2xx or transport/timeout failures.
 */
export async function getNotificationPreferences({
  cookie,
}: {
  cookie: string;
}): Promise<NotificationPreferencesDto | { unauthorized: true }> {
  const response = await apiRequest(`${apiBaseUrl()}/api/notifications/preferences`, {
    cache: 'no-store',
    cookie,
    errorClass: NotificationsError,
    transportMessage: 'Не вдалося звʼязатися з сервісом сповіщень.',
    httpMessage: (status) => `Сервіс сповіщень повернув помилку (${status}).`,
    passthrough: (status) => status === 401,
  });

  if (response.status === 401) return { unauthorized: true };

  return (await response.json()) as NotificationPreferencesDto;
}

/**
 * Update the authenticated user's notification preferences (browser-side).
 * Uses a relative URL so the Next.js `/api/*` rewrite proxies the request.
 * Throws {@link NotificationsError} on non-2xx or transport/timeout failures.
 */
export async function updateNotificationPreferences(body: {
  priceDropEnabled?: boolean;
  backInStockEnabled?: boolean;
}): Promise<NotificationPreferencesDto> {
  return apiJson<NotificationPreferencesDto>('/api/notifications/preferences', {
    method: 'PATCH',
    credentials: 'include',
    body,
    errorClass: NotificationsError,
    transportMessage: 'Не вдалося оновити налаштування сповіщень.',
    httpMessage: (status) => `Не вдалося оновити налаштування сповіщень (${status}).`,
  });
}

/**
 * Perform the global email unsubscribe via the backend token (server-side).
 * Calls `GET /api/notifications/unsubscribe?token=…`. Resolves silently on
 * any outcome — never throws to the page (the confirmation screen is always shown).
 */
export async function unsubscribe(token: string): Promise<void> {
  const url = `${apiBaseUrl()}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`;

  try {
    await apiRequest(url, {
      cache: 'no-store',
      transportMessage: 'Unsubscribe request failed.',
    });
  } catch {
    // Intentional: side-effect may have succeeded even if the response fails.
    // The confirmation screen is always shown.
  }
}
