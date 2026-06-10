import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { parseSearchQuery } from './schema.js';
import { search } from './service.js';

/**
 * Register `GET /api/search`.
 *
 * The handler is intentionally thin: validate input, delegate to the service,
 * send the result. Validation errors propagate to the app-level error handler,
 * which maps them to HTTP 400.
 */
export function registerSearchRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/api/search', async (request, reply) => {
    const params = parseSearchQuery(request.query);
    const result = await search(prisma, params);
    await reply.send(result);
  });
}
