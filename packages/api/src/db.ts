import { PrismaClient } from '@prisma/client';

// Global singleton to avoid exhausting database connections in development
// when the module is re-evaluated (e.g. during hot-reload or test runs).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
