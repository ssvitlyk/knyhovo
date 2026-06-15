import { PrismaClient, Currency, Provider, Availability, AlertStatus, AlertIntent } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // CanonicalBook 1: Кобзар (з ISBN)
  const kobzar = await prisma.canonicalBook.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '9786176795063',
    },
  });

  // CanonicalBook 2: Тіні забутих предків (без ISBN)
  const tini = await prisma.canonicalBook.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      title: 'Тіні забутих предків',
      author: 'Михайло Коцюбинський',
      isbn: null,
    },
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // ProviderListing: Кобзар на Yakaboo
  const kobzarYakaboo = await prisma.providerListing.upsert({
    where: {
      provider_url: {
        provider: Provider.YAKABOO,
        url: 'https://yakaboo.ua/kobzar-shevchenko.html',
      },
    },
    update: { priceAmount: 24900, lastSeenAt: now, availability: Availability.IN_STOCK },
    create: {
      id: '00000000-0000-4000-8001-000000000001',
      canonicalBookId: kobzar.id,
      provider: Provider.YAKABOO,
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '9786176795063',
      priceAmount: 24900,
      priceCurrency: Currency.UAH,
      url: 'https://yakaboo.ua/kobzar-shevchenko.html',
      lastSeenAt: now,
      availability: Availability.IN_STOCK,
    },
  });

  // ProviderListing: Кобзар на BookClub
  const kobzarBookclub = await prisma.providerListing.upsert({
    where: {
      provider_url: {
        provider: Provider.BOOK_CLUB,
        url: 'https://book-club.com.ua/kobzar.html',
      },
    },
    update: { priceAmount: 23500, lastSeenAt: now, availability: Availability.IN_STOCK },
    create: {
      id: '00000000-0000-4000-8001-000000000002',
      canonicalBookId: kobzar.id,
      provider: Provider.BOOK_CLUB,
      title: 'Кобзар. Повне видання',
      author: 'Шевченко Тарас',
      isbn: '9786176795063',
      priceAmount: 23500,
      priceCurrency: Currency.UAH,
      url: 'https://book-club.com.ua/kobzar.html',
      lastSeenAt: now,
      availability: Availability.IN_STOCK,
    },
  });

  // ProviderListing: Тіні забутих предків на Yakaboo
  const tiniYakaboo = await prisma.providerListing.upsert({
    where: {
      provider_url: {
        provider: Provider.YAKABOO,
        url: 'https://yakaboo.ua/tini-zabutykh-predkiv.html',
      },
    },
    update: { priceAmount: 18000, lastSeenAt: now, availability: Availability.IN_STOCK },
    create: {
      id: '00000000-0000-4000-8001-000000000003',
      canonicalBookId: tini.id,
      provider: Provider.YAKABOO,
      title: 'Тіні забутих предків',
      author: 'Михайло Коцюбинський',
      isbn: null,
      priceAmount: 18000,
      priceCurrency: Currency.UAH,
      url: 'https://yakaboo.ua/tini-zabutykh-predkiv.html',
      lastSeenAt: now,
      availability: Availability.IN_STOCK,
    },
  });

  // PriceHistoryPoints — append-only: CREATE only, no update/delete
  await prisma.priceHistoryPoint.createMany({
    skipDuplicates: true,
    data: [
      {
        id: '00000000-0000-4000-8002-000000000001',
        providerListingId: kobzarYakaboo.id,
        priceAmount: 27000,
        priceCurrency: Currency.UAH,
        recordedAt: yesterday,
      },
      {
        id: '00000000-0000-4000-8002-000000000002',
        providerListingId: kobzarYakaboo.id,
        priceAmount: 24900,
        priceCurrency: Currency.UAH,
        recordedAt: now,
      },
      {
        id: '00000000-0000-4000-8002-000000000003',
        providerListingId: kobzarBookclub.id,
        priceAmount: 23500,
        priceCurrency: Currency.UAH,
        recordedAt: now,
      },
      {
        id: '00000000-0000-4000-8002-000000000004',
        providerListingId: tiniYakaboo.id,
        priceAmount: 18000,
        priceCurrency: Currency.UAH,
        recordedAt: now,
      },
    ],
  });

  // User
  const user = await prisma.user.upsert({
    where: { email: 'test@knyhovo.dev' },
    update: {},
    create: {
      id: '00000000-0000-4000-8003-000000000001',
      email: 'test@knyhovo.dev',
    },
  });

  // WishlistItem: Кобзар у wishlist тестового користувача
  const kobzarWishlistItem = await prisma.wishlistItem.upsert({
    where: {
      userId_canonicalBookId: {
        userId: user.id,
        canonicalBookId: kobzar.id,
      },
    },
    update: {},
    create: {
      id: '00000000-0000-4000-8004-000000000001',
      userId: user.id,
      canonicalBookId: kobzar.id,
    },
  });

  // Alert: Кобзар → BELOW_CURRENT, target 200 UAH (20000 копійок).
  // Keyed by the resolved wishlist item id so the seed stays idempotent even
  // when a pre-existing wishlist row uses a different id.
  await prisma.alert.upsert({
    where: { wishlistItemId: kobzarWishlistItem.id },
    update: {
      status: AlertStatus.ACTIVE,
      intent: AlertIntent.BELOW_CURRENT,
      targetPriceAmount: 20000,
      targetPriceCurrency: Currency.UAH,
      pausedAt: null,
    },
    create: {
      wishlistItemId: kobzarWishlistItem.id,
      status: AlertStatus.ACTIVE,
      intent: AlertIntent.BELOW_CURRENT,
      targetPriceAmount: 20000,
      targetPriceCurrency: Currency.UAH,
      pausedAt: null,
    },
  });

  console.log('Seed completed:');
  console.log(`  canonical_books: ${kobzar.title}, ${tini.title}`);
  console.log(`  provider_listings: ${kobzarYakaboo.url}, ${kobzarBookclub.url}, ${tiniYakaboo.url}`);
  console.log(`  price_history: 4 points`);
  console.log(`  users: ${user.email}`);
  console.log(`  wishlist_items: Кобзар (alert: BELOW_CURRENT, target 200 UAH)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
