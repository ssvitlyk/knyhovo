import type { PrismaClient } from '@prisma/client';

/**
 * Data access for user profile settings.
 */

export async function updateUserDisplayName(
  prisma: PrismaClient,
  userId: string,
  displayName: string | null,
): Promise<{ id: string; email: string; createdAt: Date; displayName: string | null }> {
  return prisma.user.update({
    where: { id: userId },
    data: { displayName },
    select: { id: true, email: true, createdAt: true, displayName: true },
  });
}
