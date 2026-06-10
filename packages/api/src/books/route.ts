import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { parseBookParams } from './schema.js';
import { getBookDetails } from './service.js';

/**
 * Register `GET /api/books/:id`.
 *
 * The handler is intentionally thin: validate input, delegate to the service,
 * send the result. Validation and not-found errors propagate to the app-level
 * error handler, which maps them to HTTP 400 and HTTP 404 respectively.
 */
export function registerBooksRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/api/books/:id', async (request, reply) => {
    const { id } = parseBookParams(request.params);
    const result = await getBookDetails(prisma, id);
    await reply.send(result);
  });
}
