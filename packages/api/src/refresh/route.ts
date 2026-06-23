import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { getRefreshHealth } from './refresh-health.js';

export function registerRefreshHealthRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/api/refresh/health', async (_request, reply) => {
    const result = await getRefreshHealth(prisma);
    await reply.send(result);
  });
}
