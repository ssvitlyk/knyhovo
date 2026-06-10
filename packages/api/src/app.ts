import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { STATUS_CODES } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { ValidationError } from './errors.js';
import { registerSearchRoute } from './search/route.js';

/** Shape of every error response emitted by the API. */
interface ErrorBody {
  error: { code: string; message: string };
}

/**
 * Handle low-level connection errors raised by Node's HTTP parser *before*
 * routing, which therefore never reach `setErrorHandler`. Without this, Fastify
 * replies with a cryptic `{"error":"Bad Request","message":"Client Error",...}`.
 *
 * The common case here is `HPE_INVALID_URL` — an unescaped non-ASCII character
 * in the query string (e.g. a raw Cyrillic `q`) — so we return the API's
 * standard error envelope with an actionable message.
 *
 * This does NOT relax parsing (no `insecureHTTPParser`): correct clients
 * percent-encode their query parameters and are unaffected.
 */
const clientErrorHandler: NonNullable<FastifyServerOptions['clientErrorHandler']> = (error, socket): void => {
  if (error.code === 'ECONNRESET' || socket.destroyed) return;

  let statusCode = 400;
  let code = 'BAD_REQUEST';
  let message = 'Malformed request.';
  if (error.code === 'ERR_HTTP_REQUEST_TIMEOUT') {
    statusCode = 408;
    code = 'REQUEST_TIMEOUT';
    message = 'Request timed out.';
  } else if (error.code === 'HPE_HEADER_OVERFLOW') {
    statusCode = 431;
    code = 'HEADER_FIELDS_TOO_LARGE';
    message = 'Request header fields too large.';
  } else if (error.code === 'HPE_INVALID_URL') {
    message = 'Malformed request URL. Query parameters with non-ASCII characters must be percent-encoded.';
  }

  const payload = JSON.stringify({ error: { code, message } } satisfies ErrorBody);
  const reason = STATUS_CODES[statusCode] ?? 'Bad Request';
  if (socket.writable) {
    socket.write(
      `HTTP/1.1 ${statusCode} ${reason}\r\n` +
        'Connection: close\r\n' +
        'Content-Type: application/json; charset=utf-8\r\n' +
        `Content-Length: ${Buffer.byteLength(payload)}\r\n` +
        `\r\n${payload}`,
    );
  }
  socket.destroy();
};

/**
 * Build the Fastify application with its routes and error handling.
 *
 * Prisma is injected so tests can supply a fake client and production can pass
 * the shared singleton from `db.ts`.
 */
export function buildApp(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false, clientErrorHandler });

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
