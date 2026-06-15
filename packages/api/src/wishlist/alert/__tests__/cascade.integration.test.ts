import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, AlertStatus, AlertIntent, Currency } from '@prisma/client';

/**
 * Integration test: proves the `alerts.wishlist_item_id` foreign key is declared
 * ON DELETE CASCADE — deleting a wishlist item removes its associated alert at
 * the database level (not via application code).
 *
 * This requires a real Postgres database and is therefore OPT-IN: it is skipped
 * unless `RUN_DB_INTEGRATION=1` is set (so the default unit run never attempts a
 * DB connection). Run it locally with:
 *
 *   RUN_DB_INTEGRATION=1 DATABASE_URL=postgresql://... \
 *     pnpm --filter @knyhovo/api exec vitest run \
 *       src/wishlist/alert/__tests__/cascade.integration.test.ts
 */
const RUN_DB_INTEGRATION = process.env.RUN_DB_INTEGRATION === '1';

// Fixed, namespaced ids so the fixture is isolated from seed data and idempotent.
const USER_ID = 'ffffffff-0000-4000-8000-000000000001';
const USER_EMAIL = 'cascade-test@knyhovo.dev';
const BOOK_ID = 'ffffffff-0000-4000-8000-000000000002';
const ITEM_ID = 'ffffffff-0000-4000-8000-000000000003';

describe.skipIf(!RUN_DB_INTEGRATION)(
  'ON DELETE CASCADE — deleting a wishlist item removes its alert',
  () => {
    const prisma = new PrismaClient();

    async function cleanup(): Promise<void> {
      // Delete in FK dependency order so nothing blocks the user/book removal.
      await prisma.alert.deleteMany({ where: { wishlistItem: { userId: USER_ID } } });
      await prisma.wishlistItem.deleteMany({ where: { userId: USER_ID } });
      await prisma.canonicalBook.deleteMany({ where: { id: BOOK_ID } });
      await prisma.user.deleteMany({ where: { OR: [{ id: USER_ID }, { email: USER_EMAIL }] } });
    }

    beforeAll(async () => {
      await cleanup();
      await prisma.user.create({ data: { id: USER_ID, email: USER_EMAIL } });
      await prisma.canonicalBook.create({
        data: { id: BOOK_ID, title: 'Каскадна книга', author: 'Тест' },
      });
      await prisma.wishlistItem.create({
        data: { id: ITEM_ID, userId: USER_ID, canonicalBookId: BOOK_ID },
      });
      await prisma.alert.create({
        data: {
          wishlistItemId: ITEM_ID,
          status: AlertStatus.ACTIVE,
          intent: AlertIntent.BELOW_CURRENT,
          targetPriceAmount: 20000,
          targetPriceCurrency: Currency.UAH,
        },
      });
    });

    afterAll(async () => {
      await cleanup();
      await prisma.$disconnect();
    });

    it('removes the alert at the DB level when the wishlist item is deleted', async () => {
      // Precondition: the alert exists and is linked to the wishlist item.
      expect(await prisma.alert.count({ where: { wishlistItemId: ITEM_ID } })).toBe(1);

      // Act: delete only the wishlist item (no application code touches the alert).
      await prisma.wishlistItem.delete({ where: { id: ITEM_ID } });

      // Assert: the alert was removed by the ON DELETE CASCADE constraint.
      expect(await prisma.alert.count({ where: { wishlistItemId: ITEM_ID } })).toBe(0);
      expect(await prisma.wishlistItem.count({ where: { id: ITEM_ID } })).toBe(0);
    });
  },
);
