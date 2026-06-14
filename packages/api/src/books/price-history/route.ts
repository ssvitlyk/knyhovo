import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { parsePriceHistoryParams, parsePriceHistoryQuery } from './schema.js';
import { getBookPriceHistory } from './service.js';

/**
 * Register `GET /api/books/:id/price-history`.
 *
 * The handler is intentionally thin: validate input, delegate to the service,
 * send the result. Validation, not-found, and bad-request errors propagate to
 * the app-level error handler, which maps them to HTTP 400 and HTTP 404.
 */
export function registerBookPriceHistoryRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/api/books/:id/price-history', async (request, reply) => {
    const { id } = parsePriceHistoryParams(request.params);
    const { period } = parsePriceHistoryQuery(request.query);
    const result = await getBookPriceHistory(prisma, id, period, { now: () => new Date() });
    await reply.send(result);
  });
}
