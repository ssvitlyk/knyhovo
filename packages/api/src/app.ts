import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { ValidationError } from './errors.js';
import { registerSearchRoute } from './search/route.js';

/** Shape of every error response emitted by the API. */
interface ErrorBody {
  error: { code: string; message: string };
}

/**
 * Build the Fastify application with its routes and error handling.
 *
 * Prisma is injected so tests can supply a fake client and production can pass
 * the shared singleton from `db.ts`.
 */
export function buildApp(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply): void => {
    if (error instanceof ValidationError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      void reply.code(400).send(body);
      return;
    }
    if (error instanceof ZodError) {
      const body: ErrorBody = { error: { code: 'VALIDATION_ERROR', message: error.message } };
      void reply.code(400).send(body);
      return;
    }
    const body: ErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };
    void reply.code(500).send(body);
  });

  registerSearchRoute(app, prisma);

  return app;
}
