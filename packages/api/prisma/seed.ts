import {
  PrismaClient,
  Currency,
  Provider,
  Availability,
  AlertStatus,
  AlertIntent,
  CollectionType,
} from '@prisma/client';

const prisma = new PrismaClient();

// --- Deterministic id helpers ------------------------------------------------
// All demo entities use the fixed uuid family '00000000-0000-4000-80XX-...' so
// the seed is fully idempotent via upsert / skipDuplicates.
const pad = (n: number): string => n.toString().padStart(11, '0');
const bookId = (n: number): string => `00000000-0000-4000-8010-${pad(n)}`;
const listingId = (n: number): string => `00000000-0000-4000-8011-${pad(n)}`;
const historyId = (n: number): string => `00000000-0000-4000-8012-${pad(n)}`;

// The 24 warm-paper cover assets shipped in packages/web/public/covers.
// Books cycle through these; covers may repeat across books (by design).
const COVERS = [
  'atomni', 'b1984', 'dofamin', 'dotsia', 'drabyna', 'dumai',
  'dveri', 'eneida', 'feliks', 'harry', 'internat', 'kobzar',
  'lisova', 'majster', 'misto', 'perekop', 'pryntz', 'sapiens',
  'sto-rokiv', 'svitlo', 'tini', 'tonke', 'toreadory', 'tygrolovy',
] as const;
const coverUrl = (i: number): string => `/covers/${COVERS[i % COVERS.length]}.png`;

const DAY_MS = 24 * 60 * 60 * 1000;

// The 7 providers, cycled across listings for variety.
const PROVIDERS: Provider[] = [
  Provider.YAKABOO,
  Provider.BOOK_CLUB,
  Provider.VIVAT,
  Provider.BOOK_YE,
  Provider.BOOKCHEF,
  Provider.LABORATORY,
  Provider.KNIGOLAND,
];

// --- Genres (8) --------------------------------------------------------------
type GenreSeed = { slug: string; name: string; icon: string; displayOrder: number };
const GENRES: GenreSeed[] = [
  { slug: 'fantastyka', name: 'Фантастика', icon: 'rocket', displayOrder: 1 },
  { slug: 'fentezi', name: 'Фентезі', icon: 'swords', displayOrder: 2 },
  { slug: 'tryllery', name: 'Трилери', icon: 'eye', displayOrder: 3 },
  { slug: 'detektyvy', name: 'Детективи', icon: 'search', displayOrder: 4 },
  { slug: 'zhahy', name: 'Жахи', icon: 'ghost', displayOrder: 5 },
  { slug: 'young-adult', name: 'Young Adult', icon: 'sparkles', displayOrder: 6 },
  { slug: 'klasyka', name: 'Класика', icon: 'feather', displayOrder: 7 },
  { slug: 'romantyka', name: 'Романтика', icon: 'heart', displayOrder: 8 },
];

// --- Moods (6) — from the frozen collections-app.jsx MOODS list --------------
type MoodSeed = { slug: string; name: string; description: string; icon: string; displayOrder: number };
const MOODS: MoodSeed[] = [
  { slug: 'zatyshnyj-vechir', name: 'Для затишного вечора', description: 'Тепла проза, від якої не хочеться відриватись', icon: 'coffee', displayOrder: 1 },
  { slug: 'pered-snom', name: 'Перед сном', description: 'Спокійні книги, що не тримають до ранку', icon: 'moon', displayOrder: 2 },
  { slug: 'pryhody', name: 'Якщо хочеться пригод', description: 'Сюжети, що зривають з місця', icon: 'compass', displayOrder: 3 },
  { slug: 'vidpustka', name: 'Для відпустки', description: 'Легкі й захопливі — щоб узяти з собою', icon: 'plane', displayOrder: 4 },
  { slug: 'natkhnennia', name: 'Для натхнення', description: 'Книги, після яких хочеться діяти', icon: 'lightbulb', displayOrder: 5 },
  { slug: 'korotki', name: 'Короткі книги на вечір', description: 'Прочитати за один присід', icon: 'clock', displayOrder: 6 },
];

// --- Book catalog ------------------------------------------------------------
// title/author drawn from the frozen collections-app.jsx CATALOG plus plausible
// additional Ukrainian editions. `genre` is a genre slug (or null). `ageDays`
// controls createdAt: <30 marks the book a "new arrival". `drop` (optional)
// seeds an earlier higher price + current lower price into price history.
type BookSeed = {
  n: number;
  title: string;
  author: string;
  isbn: string | null;
  genre: string | null;
  price: number; // current price, kopecks
  ageDays: number;
  outOfStock?: boolean;
  drop?: number; // earlier (higher) price in kopecks; must be > price
};

// Books 1 & 2 reuse the existing canonical ids/titles (Кобзар, Тіні).
const BOOKS: BookSeed[] = [
  { n: 1, title: 'Кобзар', author: 'Тарас Шевченко', isbn: '9786176795063', genre: 'klasyka', price: 24000, ageDays: 400, drop: 27000 },
  { n: 2, title: 'Тіні забутих предків', author: 'Михайло Коцюбинський', isbn: null, genre: 'klasyka', price: 11000, ageDays: 380 },
  { n: 3, title: 'Атомні звички', author: 'Джеймс Клір', isbn: '9786177563456', genre: null, price: 28500, ageDays: 210, drop: 38000 },
  { n: 4, title: 'Sapiens: Людина розумна', author: 'Юваль Ноа Гарарі', isbn: '9786177279876', genre: null, price: 32000, ageDays: 190 },
  { n: 5, title: 'Думай повільно, вирішуй швидко', author: 'Деніел Канеман', isbn: '9786177563012', genre: null, price: 34000, ageDays: 160, drop: 42000 },
  { n: 6, title: 'Тонке мистецтво забивати', author: 'Марк Менсон', isbn: '9786177552018', genre: null, price: 24000, ageDays: 140 },
  { n: 7, title: 'Дофамінове покоління', author: 'Анна Лембке', isbn: '9786177853021', genre: null, price: 26500, ageDays: 120, drop: 31000 },
  { n: 8, title: 'Інтернат', author: 'Сергій Жадан', isbn: '9786176797043', genre: 'klasyka', price: 22000, ageDays: 300 },
  { n: 9, title: 'Доця', author: 'Тамара Горіха Зерня', isbn: '9786177754001', genre: 'klasyka', price: 21000, ageDays: 250, drop: 27500 },
  { n: 10, title: 'Фелікс Австрія', author: 'Софія Андрухович', isbn: '9786175856012', genre: 'klasyka', price: 23000, ageDays: 220, drop: 29000 },
  { n: 11, title: 'Драбина', author: 'Євгенія Кузнєцова', isbn: '9786177960014', genre: 'romantyka', price: 25000, ageDays: 25 },
  { n: 12, title: 'Той, хто відчиняє двері', author: 'Ілларіон Павлюк', isbn: '9786177960021', genre: 'tryllery', price: 29500, ageDays: 18 },
  { n: 13, title: 'Доки світло не згасне', author: 'Макс Кідрук', isbn: '9786175809037', genre: 'tryllery', price: 31000, ageDays: 22, drop: 39000 },
  { n: 14, title: 'За Перекопом є земля', author: 'Анастасія Левкова', isbn: '9786177965044', genre: 'klasyka', price: 28000, ageDays: 27 },
  { n: 15, title: 'Майстер і Маргарита', author: 'Михайло Булгаков', isbn: '9786177279053', genre: 'klasyka', price: 19500, ageDays: 320, drop: 26000 },
  { n: 16, title: 'Сто років самотності', author: 'Ґабріель Ґарсіа Маркес', isbn: '9786177279060', genre: 'klasyka', price: 30500, ageDays: 15 },
  { n: 17, title: 'Гаррі Поттер і філософський камінь', author: 'Джоан Роулінг', isbn: '9789667047078', genre: 'fentezi', price: 34000, ageDays: 12 },
  { n: 18, title: '1984', author: 'Джордж Орвелл', isbn: '9786177552087', genre: 'fantastyka', price: 18000, ageDays: 200, drop: 24000 },
  { n: 19, title: 'Маленький принц', author: 'Антуан де Сент-Екзюпері', isbn: '9789667047092', genre: 'klasyka', price: 15000, ageDays: 150 },
  { n: 20, title: 'Тигролови', author: 'Іван Багряний', isbn: '9786175856104', genre: 'klasyka', price: 17000, ageDays: 20 },
  { n: 21, title: 'Місто', author: 'Валер’ян Підмогильний', isbn: '9786175856111', genre: 'klasyka', price: 16000, ageDays: 260, drop: 21000 },
  { n: 22, title: 'Лісова пісня', author: 'Леся Українка', isbn: '9786175856128', genre: 'klasyka', price: 12000, ageDays: 340 },
  { n: 23, title: 'Енеїда', author: 'Іван Котляревський', isbn: '9786175856135', genre: 'klasyka', price: 19000, ageDays: 290 },
  { n: 24, title: 'Тореадори з Васюківки', author: 'Всеволод Нестайко', isbn: '9786175856142', genre: 'young-adult', price: 20000, ageDays: 170 },
  { n: 25, title: 'Хроніки Нарнії', author: 'Клайв Стейплз Люїс', isbn: '9786177960158', genre: 'fentezi', price: 33000, ageDays: 110, drop: 41000 },
  { n: 26, title: 'Гра престолів', author: 'Джордж Мартін', isbn: '9786177960165', genre: 'fentezi', price: 39000, ageDays: 14 },
  { n: 27, title: 'Відьмак: Останнє бажання', author: 'Анджей Сапковський', isbn: '9786177960172', genre: 'fentezi', price: 35000, ageDays: 80, drop: 42000 },
  { n: 28, title: 'Дюна', author: 'Френк Герберт', isbn: '9786177960189', genre: 'fantastyka', price: 37000, ageDays: 16 },
  { n: 29, title: 'Марсіанин', author: 'Енді Вейр', isbn: '9786177960196', genre: 'fantastyka', price: 29000, ageDays: 130 },
  { n: 30, title: 'Проєкт «Ейв Марія»', author: 'Енді Вейр', isbn: '9786177960202', genre: 'fantastyka', price: 32500, ageDays: 24 },
  { n: 31, title: 'Дівчина з татуюванням дракона', author: 'Стіг Ларссон', isbn: '9786177960219', genre: 'detektyvy', price: 30000, ageDays: 95, drop: 36000 },
  { n: 32, title: 'Вбивство у «Східному експресі»', author: 'Агата Крісті', isbn: '9786177960226', genre: 'detektyvy', price: 22000, ageDays: 150 },
  { n: 33, title: 'Десять негренят', author: 'Агата Крісті', isbn: '9786177960233', genre: 'detektyvy', price: 21500, ageDays: 175 },
  { n: 34, title: 'Дівчина у потягу', author: 'Пола Гоукінз', isbn: '9786177960240', genre: 'tryllery', price: 24500, ageDays: 105 },
  { n: 35, title: 'Зникла', author: 'Ґіліян Флінн', isbn: '9786177960257', genre: 'tryllery', price: 26000, ageDays: 60, drop: 33000 },
  { n: 36, title: 'Воно', author: 'Стівен Кінг', isbn: '9786177960264', genre: 'zhahy', price: 41000, ageDays: 70 },
  { n: 37, title: 'Сяйво', author: 'Стівен Кінг', isbn: '9786177960271', genre: 'zhahy', price: 28000, ageDays: 210, drop: 35000 },
  { n: 38, title: 'Джерело', author: 'Стівен Кінг', isbn: '9786177960288', genre: 'zhahy', price: 30000, ageDays: 45 },
  { n: 39, title: 'Провина зірок', author: 'Джон Грін', isbn: '9786177960295', genre: 'young-adult', price: 23000, ageDays: 190 },
  { n: 40, title: 'Голодні ігри', author: 'Сюзанна Коллінз', isbn: '9786177960301', genre: 'young-adult', price: 27500, ageDays: 26, drop: 34000 },
  { n: 41, title: 'Сутінки', author: 'Стефені Маєр', isbn: '9786177960318', genre: 'young-adult', price: 25000, ageDays: 220 },
  { n: 42, title: 'Гордість і упередження', author: 'Джейн Остін', isbn: '9786177960325', genre: 'romantyka', price: 19000, ageDays: 240, drop: 25000 },
  { n: 43, title: 'Поговори зі мною', author: 'Саллі Руні', isbn: '9786177960332', genre: 'romantyka', price: 26500, ageDays: 30 },
  { n: 44, title: 'Нормальні люди', author: 'Саллі Руні', isbn: '9786177960349', genre: 'romantyka', price: 27000, ageDays: 100 },
  { n: 45, title: 'Кличе мене минуле', author: 'Даяна Ґабалдон', isbn: '9786177960356', genre: 'romantyka', price: 33000, ageDays: 200, outOfStock: true },
  { n: 46, title: 'Пісня Ахілла', author: 'Мадлен Міллер', isbn: '9786177960363', genre: 'fentezi', price: 28500, ageDays: 55, outOfStock: true },
  { n: 47, title: 'Цірцея', author: 'Мадлен Міллер', isbn: '9786177960370', genre: 'fentezi', price: 29000, ageDays: 180, outOfStock: true, drop: 35000 },
  { n: 48, title: 'Американські боги', author: 'Ніл Ґейман', isbn: '9786177960387', genre: 'fantastyka', price: 34500, ageDays: 160, outOfStock: true },
  { n: 49, title: 'Кладовище домашніх тварин', author: 'Стівен Кінг', isbn: '9786177960394', genre: 'zhahy', price: 27000, ageDays: 230, outOfStock: true },
  { n: 50, title: 'Хребти безумства', author: 'Говард Лавкрафт', isbn: '9786177960400', genre: 'zhahy', price: 21000, ageDays: 145, outOfStock: true },
  { n: 51, title: 'Крадійка книжок', author: 'Маркус Зузак', isbn: '9786177960417', genre: 'klasyka', price: 26000, ageDays: 21 },
  { n: 52, title: 'Аустерліц', author: 'Вінфрід Зебальд', isbn: '9786177960424', genre: 'klasyka', price: 24000, ageDays: 260, outOfStock: true },
];

async function main(): Promise<void> {
  const now = new Date();

  // --- Genres ---------------------------------------------------------------
  const genreIdBySlug = new Map<string, string>();
  for (const g of GENRES) {
    const row = await prisma.genre.upsert({
      where: { slug: g.slug },
      update: { name: g.name, icon: g.icon, displayOrder: g.displayOrder },
      create: { slug: g.slug, name: g.name, icon: g.icon, displayOrder: g.displayOrder },
    });
    genreIdBySlug.set(g.slug, row.id);
  }

  // --- Moods ----------------------------------------------------------------
  for (const m of MOODS) {
    await prisma.mood.upsert({
      where: { slug: m.slug },
      update: { name: m.name, description: m.description, icon: m.icon, displayOrder: m.displayOrder },
      create: { slug: m.slug, name: m.name, description: m.description, icon: m.icon, displayOrder: m.displayOrder },
    });
  }

  // --- Canonical books + provider listings + price history ------------------
  let listingSeq = 0;
  let historySeq = 0;
  const historyRows: {
    id: string;
    providerListingId: string;
    priceAmount: number;
    priceCurrency: Currency;
    availability: Availability;
    recordedAt: Date;
  }[] = [];

  for (const b of BOOKS) {
    const id = bookId(b.n);
    const createdAt = new Date(now.getTime() - b.ageDays * DAY_MS);
    const genreId = b.genre ? (genreIdBySlug.get(b.genre) ?? null) : null;
    const availability = b.outOfStock ? Availability.OUT_OF_STOCK : Availability.IN_STOCK;
    const slug = b.title
      .toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
      .replace(/(^-|-$)/g, '');

    await prisma.canonicalBook.upsert({
      where: { id },
      update: { title: b.title, author: b.author, isbn: b.isbn, genreId },
      create: { id, title: b.title, author: b.author, isbn: b.isbn, genreId, createdAt },
    });

    // 1-2 listings per book. Second listing added for the first ~20 books to
    // give multi-store price comparisons; provider cycles across all 7 values.
    const listingCount = b.n <= 20 ? 2 : 1;
    for (let li = 0; li < listingCount; li += 1) {
      listingSeq += 1;
      const provider = PROVIDERS[(b.n + li) % PROVIDERS.length];
      const price = b.price + li * 800; // second store slightly pricier
      const url = `https://demo.knyhovo.dev/${provider.toLowerCase()}/${slug}-${b.n}-${li}`;
      const listing = await prisma.providerListing.upsert({
        where: { provider_url: { provider, url } },
        update: { priceAmount: price, lastSeenAt: now, availability, coverUrl: coverUrl(b.n) },
        create: {
          id: listingId(listingSeq),
          canonicalBookId: id,
          provider,
          title: b.title,
          author: b.author,
          isbn: b.isbn,
          priceAmount: price,
          priceCurrency: Currency.UAH,
          url,
          lastSeenAt: now,
          availability,
          coverUrl: coverUrl(b.n),
        },
      });

      // Price history: on the primary listing, seed a real drop when defined.
      if (li === 0 && b.drop && b.drop > b.price) {
        historySeq += 1;
        historyRows.push({
          id: historyId(historySeq),
          providerListingId: listing.id,
          priceAmount: b.drop,
          priceCurrency: Currency.UAH,
          availability: Availability.IN_STOCK,
          recordedAt: new Date(now.getTime() - 14 * DAY_MS),
        });
      }
      // Always record the current point (append-only, deduped).
      historySeq += 1;
      historyRows.push({
        id: historyId(historySeq),
        providerListingId: listing.id,
        priceAmount: price,
        priceCurrency: Currency.UAH,
        availability,
        recordedAt: now,
      });
    }
  }

  // Append-only price history: CREATE only, deduped by id.
  await prisma.priceHistoryPoint.createMany({ skipDuplicates: true, data: historyRows });

  // --- User (existing test user) --------------------------------------------
  const user = await prisma.user.upsert({
    where: { email: 'test@knyhovo.dev' },
    update: {},
    create: { id: '00000000-0000-4000-8003-000000000001', email: 'test@knyhovo.dev' },
  });

  // --- Wishlist items (existing user, ~10 varied books) ---------------------
  const wishlistBookNs = [1, 3, 5, 12, 17, 26, 28, 35, 40, 51];
  let wishlistItemForKobzarId = '';
  for (let i = 0; i < wishlistBookNs.length; i += 1) {
    const n = wishlistBookNs[i];
    const item = await prisma.wishlistItem.upsert({
      where: { userId_canonicalBookId: { userId: user.id, canonicalBookId: bookId(n) } },
      update: {},
      create: {
        id: `00000000-0000-4000-8004-${pad(i + 1)}`,
        userId: user.id,
        canonicalBookId: bookId(n),
      },
    });
    if (n === 1) wishlistItemForKobzarId = item.id;
  }

  // --- Alert on Кобзар (BELOW_CURRENT, target 200 UAH) ----------------------
  await prisma.alert.upsert({
    where: { wishlistItemId: wishlistItemForKobzarId },
    update: {
      status: AlertStatus.ACTIVE,
      intent: AlertIntent.BELOW_CURRENT,
      targetPriceAmount: 20000,
      targetPriceCurrency: Currency.UAH,
      pausedAt: null,
    },
    create: {
      wishlistItemId: wishlistItemForKobzarId,
      status: AlertStatus.ACTIVE,
      intent: AlertIntent.BELOW_CURRENT,
      targetPriceAmount: 20000,
      targetPriceCurrency: Currency.UAH,
      pausedAt: null,
    },
  });

  // --- Collections ----------------------------------------------------------
  type CollectionSeed = {
    slug: string;
    type: CollectionType;
    title: string;
    eyebrow: string | null;
    description: string | null;
    statusLabel: string | null;
    icon: string | null;
    displayOrder: number;
    bookNs: number[];
  };
  const COLLECTIONS: CollectionSeed[] = [
    {
      slug: 'knyhovyk-radyt',
      type: CollectionType.FEATURED,
      title: 'Книговик радить',
      eyebrow: null,
      description: 'Тепла добірка від Книговика — те, що варто почитати саме зараз.',
      statusLabel: 'Оновлюється щотижня',
      icon: 'bookmark',
      displayOrder: 1,
      bookNs: [16, 26, 28, 12, 40, 13, 51, 3, 10, 30, 43, 17],
    },
    {
      slug: 'buker-2026',
      type: CollectionType.EDITORIAL,
      title: 'Букерівський список 2026',
      eyebrow: 'Свіже',
      description: 'Фіналісти й лауреати цьогорічної премії — усі в одному місці.',
      statusLabel: null,
      icon: 'award',
      displayOrder: 2,
      bookNs: [16, 15, 5, 4, 18, 19, 21, 8, 9, 10, 44, 51],
    },
    {
      slug: 'ukr-fentezi',
      type: CollectionType.EDITORIAL,
      title: 'Українське фентезі, яке варто знати',
      eyebrow: 'Тема',
      description: 'Світи, магія й міфи — від українських і світових авторів.',
      statusLabel: null,
      icon: 'swords',
      displayOrder: 3,
      bookNs: [17, 25, 26, 27, 46, 47, 48, 28, 14, 20, 11, 22],
    },
    {
      slug: 'nonfiction',
      type: CollectionType.EDITORIAL,
      title: 'Нон-фікшн для довгих вечорів',
      eyebrow: 'Для розуму',
      description: 'Ідеї, що змінюють оптику — без поспіху й галасу.',
      statusLabel: null,
      icon: 'lightbulb',
      displayOrder: 4,
      bookNs: [4, 3, 7, 5, 6, 18, 16, 8, 9, 14, 44, 51],
    },
    {
      slug: 'pryhovani-skarby',
      type: CollectionType.CURATED,
      title: 'Приховані скарби',
      eyebrow: 'Недооцінені книги',
      description: 'Книги, які варті більшої уваги, ніж отримали.',
      statusLabel: null,
      icon: 'gem',
      displayOrder: 5,
      bookNs: [21, 22, 23, 24, 20, 14, 33, 50, 47, 42, 11, 30],
    },
  ];

  for (const c of COLLECTIONS) {
    const collection = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {
        type: c.type,
        title: c.title,
        eyebrow: c.eyebrow,
        description: c.description,
        statusLabel: c.statusLabel,
        icon: c.icon,
        displayOrder: c.displayOrder,
        isActive: true,
      },
      create: {
        slug: c.slug,
        type: c.type,
        title: c.title,
        eyebrow: c.eyebrow,
        description: c.description,
        statusLabel: c.statusLabel,
        icon: c.icon,
        displayOrder: c.displayOrder,
        isActive: true,
      },
    });

    for (let i = 0; i < c.bookNs.length; i += 1) {
      const canonicalBookId = bookId(c.bookNs[i]);
      await prisma.collectionItem.upsert({
        where: {
          collectionId_canonicalBookId: {
            collectionId: collection.id,
            canonicalBookId,
          },
        },
        update: { sortOrder: i },
        create: { collectionId: collection.id, canonicalBookId, sortOrder: i },
      });
    }
  }

  // --- Dynamic feed metadata (DYNAMIC collections; no items — computed feeds) -
  type DynamicSeed = {
    slug: string;
    title: string;
    eyebrow: string | null;
    description: string | null;
    statusLabel: string | null;
    icon: string | null;
    displayOrder: number;
  };
  const DYNAMIC_COLLECTIONS: DynamicSeed[] = [
    {
      slug: 'najbilsh-bazhani',
      title: 'Обране читачами',
      eyebrow: null,
      description: 'Книги, які найчастіше додають у список бажаного.',
      statusLabel: 'На основі активності читачів',
      icon: 'heart',
      displayOrder: 1,
    },
    {
      slug: 'populyarne-zaraz',
      title: 'Популярне зараз',
      eyebrow: null,
      description: 'Те, що зараз цікавить інших читачів найбільше.',
      statusLabel: 'Популярне серед читачів',
      icon: 'flame',
      displayOrder: 2,
    },
    {
      slug: 'novynky',
      title: 'Новинки',
      eyebrow: null,
      description: 'Найсвіжіші видання за останній місяць.',
      statusLabel: 'Нові надходження',
      icon: 'sparkle',
      displayOrder: 3,
    },
    {
      slug: 'znyzhky',
      title: 'Найбільші знижки',
      eyebrow: null,
      description: 'Книги з найпомітнішим падінням ціни просто зараз.',
      statusLabel: 'Актуальні пропозиції',
      icon: 'percent',
      displayOrder: 4,
    },
  ];

  for (const d of DYNAMIC_COLLECTIONS) {
    await prisma.collection.upsert({
      where: { slug: d.slug },
      update: {
        type: CollectionType.DYNAMIC,
        title: d.title,
        eyebrow: d.eyebrow,
        description: d.description,
        statusLabel: d.statusLabel,
        icon: d.icon,
        displayOrder: d.displayOrder,
        isActive: true,
      },
      create: {
        slug: d.slug,
        type: CollectionType.DYNAMIC,
        title: d.title,
        eyebrow: d.eyebrow,
        description: d.description,
        statusLabel: d.statusLabel,
        icon: d.icon,
        displayOrder: d.displayOrder,
        isActive: true,
      },
    });
  }

  // --- Mood collections (MOOD type; slug = Mood.slug) + linked books --------
  // Book numbers curated per mood from the existing catalog (8-12 books each).
  const MOOD_BOOK_NS: Record<string, number[]> = {
    'zatyshnyj-vechir': [8, 9, 10, 21, 43, 44, 1, 22, 51, 2],
    'pered-snom': [19, 22, 2, 23, 1, 21, 9, 51],
    pryhody: [26, 27, 28, 29, 30, 12, 13, 17, 25, 36],
    vidpustka: [39, 40, 41, 24, 45, 46, 34, 35, 16, 31],
    natkhnennia: [3, 4, 5, 6, 7, 14, 9, 10, 51],
    korotki: [19, 2, 22, 23, 1, 51, 20, 21],
  };

  for (const m of MOODS) {
    const collection = await prisma.collection.upsert({
      where: { slug: m.slug },
      update: {
        type: CollectionType.MOOD,
        title: m.name,
        eyebrow: null,
        description: m.description,
        statusLabel: null,
        icon: m.icon,
        displayOrder: m.displayOrder,
        isActive: true,
      },
      create: {
        slug: m.slug,
        type: CollectionType.MOOD,
        title: m.name,
        eyebrow: null,
        description: m.description,
        statusLabel: null,
        icon: m.icon,
        displayOrder: m.displayOrder,
        isActive: true,
      },
    });

    const bookNs = MOOD_BOOK_NS[m.slug] ?? [];
    for (let i = 0; i < bookNs.length; i += 1) {
      const canonicalBookId = bookId(bookNs[i]);
      await prisma.collectionItem.upsert({
        where: {
          collectionId_canonicalBookId: {
            collectionId: collection.id,
            canonicalBookId,
          },
        },
        update: { sortOrder: i },
        create: { collectionId: collection.id, canonicalBookId, sortOrder: i },
      });
    }
  }

  const newArrivals = BOOKS.filter((b) => b.ageDays < 30).length;
  const withDrop = BOOKS.filter((b) => b.drop).length;
  const outOfStock = BOOKS.filter((b) => b.outOfStock).length;

  console.log('Seed completed:');
  console.log(`  genres: ${GENRES.length}`);
  console.log(`  moods: ${MOODS.length}`);
  console.log(`  canonical_books: ${BOOKS.length} (${newArrivals} new arrivals, ${outOfStock} out-of-stock)`);
  console.log(`  provider_listings: ${listingSeq}`);
  console.log(`  price_history: ${historyRows.length} points (${withDrop} books with a real drop)`);
  console.log(`  users: ${user.email}`);
  console.log(`  wishlist_items: ${wishlistBookNs.length} (alert on Кобзар: BELOW_CURRENT, target 200 UAH)`);
  console.log(`  collections: ${COLLECTIONS.length} (${COLLECTIONS.reduce((s, c) => s + c.bookNs.length, 0)} items)`);
  console.log(`  dynamic_collections: ${DYNAMIC_COLLECTIONS.length} (metadata only, no items)`);
  console.log(
    `  mood_collections: ${MOODS.length} (${Object.values(MOOD_BOOK_NS).reduce((s, ns) => s + ns.length, 0)} items)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
