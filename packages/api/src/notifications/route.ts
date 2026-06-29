import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../auth/service.js';
import { resolveSessionUser } from '../auth/service.js';
import { SESSION_COOKIE } from '../auth/cookie.js';
import { UnauthorizedError } from '../errors.js';
import { parseUpdatePreferencesBody, parseUnsubscribeQuery } from './schema.js';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  unsubscribeByToken,
} from './repository.js';

const UNSUBSCRIBE_PAGE =
  `<!doctype html><html lang="uk"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1"><title>Knyhovo</title></head>` +
  `<body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 16px">` +
  `<h1>Готово</h1><p>Ви відписалися від email-сповіщень Knyhovo. ` +
  `Керувати налаштуваннями можна у вашому профілі.</p></body></html>`;

/**
 * Public one-click unsubscribe (no auth) — backs the List-Unsubscribe header.
 * Idempotent and non-enumerating: always returns the same confirmation page,
 * whether or not the token matched a user.
 */
export function registerUnsubscribeRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/api/notifications/unsubscribe', async (request, reply) => {
    const { token } = parseUnsubscribeQuery(request.query);
    await unsubscribeByToken(prisma, token, new Date());
    await reply.type('text/html; charset=utf-8').send(UNSUBSCRIBE_PAGE);
  });
}

/**
 * Authenticated notification-preference management.
 *
 *  GET   /api/notifications/preferences  — current preferences
 *  PATCH /api/notifications/preferences  — toggle per-type flags / resubscribe
 */
export function registerNotificationPreferencesRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  authDeps: AuthDeps,
): void {
  app.get('/api/notifications/preferences', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const prefs = await getNotificationPreferences(prisma, user.id);
    if (!prefs) throw new UnauthorizedError();
    await reply.send(prefs);
  });

  app.patch('/api/notifications/preferences', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const body = parseUpdatePreferencesBody(request.body);
    const prefs = await updateNotificationPreferences(prisma, user.id, body);
    if (!prefs) throw new UnauthorizedError();
    await reply.send(prefs);
  });
}
