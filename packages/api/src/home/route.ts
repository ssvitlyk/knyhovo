import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../auth/service.js';
import { optionalUser } from '../auth/guard.js';
import type { Clock } from '../clock.js';
import { systemClock } from '../clock.js';
import { getHome } from './service.js';

/**
 * Register `GET /api/home` — the composed homepage feed. Public browsing
 * surface, no auth required.
 *
 * `authDeps` is optional (mirrors `registerCollectionsRoute`): when present, the
 * current session (if any) is resolved to decorate `isWishlisted`. Guests — and
 * callers that omit `authDeps` — get the same composition with
 * `isWishlisted: false`, never a 401.
 *
 * `clock` is injectable so integration tests can pin `now` (deterministic
 * novynky window); production uses {@link systemClock}.
 */
export function registerHomeRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  authDeps?: AuthDeps,
  clock: Clock = systemClock,
): void {
  app.get('/api/home', async (request, reply) => {
    const user = await optionalUser(authDeps, request);
    await reply.send(await getHome(prisma, user?.id ?? null, clock));
  });
}
