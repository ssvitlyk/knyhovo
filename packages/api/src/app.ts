import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import { STATUS_CODES } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import {
  ValidationError,
  BadRequestError,
  BookNotFoundError,
  UnauthorizedError,
  InvalidCredentialsError,
  RateLimitedError,
  WishlistItemNotFoundError,
} from './errors.js';
import { registerSearchRoute } from './search/route.js';
import { registerBooksRoute } from './books/route.js';
import { registerBookPriceHistoryRoute } from './books/price-history/route.js';
import { registerRefreshHealthRoute } from './refresh/route.js';
import { registerMetricsRoute } from './metrics/route.js';
import { registerAuthRoute } from './auth/route.js';
import { registerWishlistRoute } from './wishlist/route.js';
import { registerWishlistAlertRoute } from './wishlist/alert/route.js';
import type { AuthDeps } from './auth/service.js';

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
 *
 * `authDeps` is optional. When omitted, auth routes are NOT registered — this
 * keeps existing search/books tests green without needing AUTH_SECRET in env.
 * Production (server.ts) builds real AuthDeps and passes them here.
 */
export function buildApp(prisma: PrismaClient, authDeps?: AuthDeps): FastifyInstance {
  const app = Fastify({ logger: false, clientErrorHandler });

  // Register cookie plugin — required for session cookie support.
  // @fastify/cookie is queued before listen() so app.inject() in tests
  // awaits it automatically.
  void app.register(cookie);

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
    if (error instanceof BadRequestError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      void reply.code(400).send(body);
      return;
    }
    if (error instanceof BookNotFoundError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      void reply.code(404).send(body);
      return;
    }
    if (error instanceof UnauthorizedError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      void reply.code(401).send(body);
      return;
    }
    if (error instanceof InvalidCredentialsError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      void reply.code(401).send(body);
      return;
    }
    if (error instanceof RateLimitedError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      void reply.code(429).send(body);
      return;
    }
    if (error instanceof WishlistItemNotFoundError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      void reply.code(404).send(body);
      return;
    }
    const body: ErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };
    void reply.code(500).send(body);
  });

  registerSearchRoute(app, prisma);
  registerBooksRoute(app, prisma);
  registerBookPriceHistoryRoute(app, prisma);
  registerRefreshHealthRoute(app, prisma);
  registerMetricsRoute(app, prisma);

  // Auth routes are only registered when deps are provided.
  // Tests that don't exercise auth can call buildApp(prisma) without
  // setting AUTH_SECRET in process.env.
  if (authDeps) {
    registerAuthRoute(app, authDeps);
    registerWishlistRoute(app, prisma, authDeps);
    registerWishlistAlertRoute(app, prisma, authDeps);
  }

  return app;
}
