import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../auth/service.js';
import { resolveSessionUser } from '../auth/service.js';
import { SESSION_COOKIE } from '../auth/cookie.js';
import { UnauthorizedError } from '../errors.js';
import { toAuthUserDto } from '../auth/mapper.js';
import { parseUpdateProfileBody } from './schema.js';
import { updateUserDisplayName } from './repository.js';

/**
 * Authenticated profile management.
 *
 *  PATCH /api/profile  — update the user's display name
 */
export function registerProfileRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  authDeps: AuthDeps,
): void {
  app.patch('/api/profile', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const body = parseUpdateProfileBody(request.body);
    const row = await updateUserDisplayName(prisma, user.id, body.displayName);
    await reply.send(toAuthUserDto(row));
  });
}
