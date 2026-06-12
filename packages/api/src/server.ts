import { buildApp } from './app.js';
import { prisma } from './db.js';
import { loadAuthConfig } from './auth/config.js';
import { ConsoleMailer } from './auth/mailer.js';
import { generateCode, generateToken } from './auth/crypto.js';
import type { AuthDeps } from './auth/service.js';

const PORT = Number(process.env['PORT'] ?? 3000);

const authDeps: AuthDeps = {
  prisma,
  mailer: new ConsoleMailer(),
  config: loadAuthConfig(),
  now: () => new Date(),
  generateCode,
  generateToken,
};

const app = buildApp(prisma, authDeps);

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`API listening on ${address}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
