import { buildApp } from './app.js';
import { prisma } from './db.js';

const PORT = Number(process.env['PORT'] ?? 3000);

const app = buildApp(prisma);

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`API listening on ${address}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
