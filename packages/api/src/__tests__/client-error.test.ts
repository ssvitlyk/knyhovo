import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../app.js';

// The clientErrorHandler runs at the HTTP-parser layer, so it can only be
// exercised over a real socket (not `app.inject`, which bypasses the parser).
// The route never executes for these requests, so a stub Prisma is sufficient.
const stubPrisma = {} as unknown as PrismaClient;

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

/** Send a raw HTTP request line verbatim and resolve the full response text. */
function sendRaw(port: number, requestLine: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`${requestLine}\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
    });
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => (buffer += chunk));
    socket.on('close', () => resolve(buffer));
    socket.on('error', reject);
  });
}

describe('clientErrorHandler (HTTP-parser level)', () => {
  it('returns an informative 400 envelope for a malformed URL (control character)', async () => {
    app = buildApp(stubPrisma);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;

    // A raw control character (0x01) in the request target is rejected by
    // llhttp with HPE_INVALID_URL, exercising the clientErrorHandler at the
    // HTTP-parser layer. (Raw non-ASCII bytes such as Cyrillic are no longer
    // rejected by the parser on Node 20.19+, so they cannot drive this branch.)
    const response = await sendRaw(port, 'GET /api/search?q=\x01 HTTP/1.1');

    const statusLine = response.split('\r\n')[0];
    const body = response.slice(response.indexOf('\r\n\r\n') + 4);
    expect(statusLine).toContain('400');

    const parsed = JSON.parse(body) as { error: { code: string; message: string } };
    expect(parsed.error.code).toBe('BAD_REQUEST');
    expect(parsed.error.message).toMatch(/percent-encoded/i);
  });
});
