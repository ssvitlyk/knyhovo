import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getCollectionBooks, getCollectionsHub } from '@/lib/api/collections';
import type { CollectionBookDto, CollectionsHubDto } from '@/lib/api/types';
import { allocate } from '@/lib/collections/allocate';
import { shelfBadgeFor, type ShelfKind } from '@/lib/collections/badges';
import { buildCollectionPageJsonLd } from '@/lib/seo/collections-jsonld';
import { CollectionsNav } from '@/components/collections/CollectionsNav';
import { FeaturedCard } from '@/components/collections/FeaturedCard';
import { BookSection, SecDivider } from '@/components/collections/BookSection';
import { SecHead } from '@/components/collections/SecHead';
import { MoodSection } from '@/components/collections/MoodSection';
import { FreshSection, type WeeklyCardData } from '@/components/collections/FreshSection';
import { GemsBand } from '@/components/collections/GemsBand';
import { BooksGridRetry } from '@/components/collections/BooksGrid';
import { DynIcon } from '@/components/collections/icons';
import type { ShelfItem } from '@/components/collections/Shelf';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Добірки книг · Порівняти ціни · Knyhovo',
  description:
    'Добірки паперових книг від Книговика: популярне, новинки, знижки, жанри та настрої. Порівняйте ціни у книгарнях.',
  alternates: { canonical: '/dobirky', languages: { uk: '/dobirky' } },
};

/**
 * Cross-section dedup priority + shelf sizes. Rail shelves show 12 books
 * (product decision 2026-07-07; the frozen mock's 5 was a preview size —
 * kept only on the home page). `gems` stays 3: it renders a fanned cover
 * trio, not a rail.
 */
const SHELF_TAKES = { gems: 3, znyzhky: 12, obrane: 12, novynky: 12, popular: 12 } as const;

/**
 * How many 24-book API pages each shelf's candidate pool fetches. The greedy
 * allocate consumes ids in priority order, so a later shelf must survive the
 * worst case where every id taken by earlier shelves also sits at the top of
 * its own pool: pool size ≥ take + Σ earlier takes (gems 3 → znyzhky 15 →
 * obrane 27 → novynky 39 → popular 51). Without this, «Популярне зараз» (whose
 * relevance order overlaps wishlist + newest almost exactly) starves on a
 * single page and the section disappears.
 */
const SHELF_PAGES = { gems: 1, znyzhky: 1, obrane: 2, novynky: 2, popular: 3 } as const;

const SHELF_SLUGS: Readonly<Record<string, string>> = {
  obrane: 'najbilsh-bazhani',
  popular: 'populyarne-zaraz',
  novynky: 'novynky',
  znyzhky: 'znyzhky',
  gems: 'pryhovani-skarby',
};

async function booksOf(slug: string, cookie: string, pages = 1): Promise<readonly CollectionBookDto[]> {
  try {
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) => getCollectionBooks({ slug, page: i + 1, cookie })),
    );
    return results.flatMap((r) => r.books);
  } catch (error) {
    console.error('[dobirky] shelf fetch failed', { slug, error });
    return []; // degraded shelf — the section renders with what survived dedup
  }
}

function shelfItems(shelf: ShelfKind, books: readonly CollectionBookDto[]): ShelfItem[] {
  return books.map((book, index) => ({ book, badge: shelfBadgeFor(shelf, book, index) }));
}

/**
 * `/dobirky` — the Collections hub (SSR). Section order is frozen §6 minus the
 * «За жанром» grid (removed 2026-07-04, user decision — genres live in the nav):
 * hero → Обране читачами → mood band → Популярне зараз →
 * divider + Новинки місяця → divider + Добірки редакції → Найбільші знижки →
 * Недооцінені книги → footer. Books come from per-collection `:slug/books`
 * calls; the greedy allocate keeps every book on exactly one shelf.
 *
 * The hub tolerates an "empty collections" state (unseeded DB): `hub.featured`
 * may be `null`, and any weekly/mood/shelf collection may have zero books —
 * those degrade to a hidden section, never the fetch-failure retry block
 * (which stays reserved for an actual `getCollectionsHub` rejection below).
 */
export default async function DobirkyPage(): Promise<React.JSX.Element> {
  const cookie = (await cookies()).toString();

  let hub: CollectionsHubDto;
  try {
    hub = await getCollectionsHub({ cookie });
  } catch (error) {
    console.error('[dobirky] hub fetch failed', error);
    return (
      <main className="dobirky-scope">
        <BooksGridRetry />
      </main>
    );
  }

  const weeklyCollections = hub.weekly.filter((w) => w.bookCount > 0);
  const moods = hub.moods.filter((m) => m.bookCount > 0);
  const hasFeatured = hub.featured !== null && hub.featured.collection.bookCount > 0;

  const [obrane, popular, novynky, znyzhky, gems, ...weeklyBooks] = await Promise.all([
    booksOf(SHELF_SLUGS.obrane, cookie, SHELF_PAGES.obrane),
    booksOf(SHELF_SLUGS.popular, cookie, SHELF_PAGES.popular),
    booksOf(SHELF_SLUGS.novynky, cookie, SHELF_PAGES.novynky),
    booksOf(SHELF_SLUGS.znyzhky, cookie, SHELF_PAGES.znyzhky),
    booksOf(SHELF_SLUGS.gems, cookie, SHELF_PAGES.gems),
    ...weeklyCollections.map((w) => booksOf(w.slug, cookie)),
  ]);

  const alloc = allocate<CollectionBookDto>([
    { key: 'gems', take: SHELF_TAKES.gems, pool: gems },
    { key: 'znyzhky', take: SHELF_TAKES.znyzhky, pool: znyzhky },
    { key: 'obrane', take: SHELF_TAKES.obrane, pool: obrane },
    { key: 'novynky', take: SHELF_TAKES.novynky, pool: novynky },
    { key: 'popular', take: SHELF_TAKES.popular, pool: popular },
  ]);

  const weekly: WeeklyCardData[] = weeklyCollections.map((collection, i) => ({
    collection,
    covers: (weeklyBooks[i] ?? []).slice(0, 12).map((b) => ({ url: b.coverUrl, title: b.title })),
  }));

  const obraneItems = shelfItems('obrane', alloc.obrane ?? []);
  const popularItems = shelfItems('popular', alloc.popular ?? []);
  const novynkyItems = shelfItems('novynky', alloc.novynky ?? []);
  const znyzhkyItems = shelfItems('znyzhky', alloc.znyzhky ?? []);
  const gemsCovers = (alloc.gems ?? []).map((b) => b.coverUrl);

  const isFullyEmpty =
    !hasFeatured &&
    moods.length === 0 &&
    weekly.length === 0 &&
    obraneItems.length === 0 &&
    popularItems.length === 0 &&
    novynkyItems.length === 0 &&
    znyzhkyItems.length === 0 &&
    gemsCovers.length === 0;

  const jsonLd = buildCollectionPageJsonLd(
    SITE_URL,
    '/dobirky',
    'Добірки книг',
    'Добірки паперових книг від Книговика: популярне, новинки, знижки, жанри та настрої.',
  );

  return (
    <>
      <CollectionsNav genres={hub.genres} />
      <main className="dobirky-scope">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {isFullyEmpty ? (
          <div className="cd-empty">У добірках поки немає книг.</div>
        ) : (
          <>
            {/* 1 · Hero — FROZEN featured block (editorial); hidden when the
                collections table has no `knyhovyk-radyt` row (`hub.featured === null`)
                or the featured collection has no books yet. */}
            {hasFeatured && hub.featured ? (
              <section className="sec sec--hero reveal">
                <FeaturedCard collection={hub.featured.collection} />
              </section>
            ) : null}

            {/* 2 · Обране читачами — establishing discovery shelf (FULL header).
                Unlike the other shelves, an empty pool here is an expected state
                (a fresh install has no wishlist activity yet), so the section
                shows a quiet empty hint instead of silently disappearing. */}
            {obraneItems.length > 0 ? (
              <BookSection
                id="obrane"
                eyebrow={
                  <span className="sec-eyebrow--rose">
                    <DynIcon name="heart" size={13} solid />
                    Найчастіше додають у бажанки
                  </span>
                }
                title="Обране читачами"
                sub="Книги, які читачі Knyhovo найчастіше додають до своїх бажанок."
                fresh={{ text: 'На основі активності читачів' }}
                allLabel="Усі улюблені"
                allHref="/dobirky/najbilsh-bazhani"
                items={obraneItems}
              />
            ) : (
              <section className="sec reveal" id="obrane">
                <SecHead
                  eyebrow={
                    <span className="sec-eyebrow--rose">
                      <DynIcon name="heart" size={13} solid />
                      Найчастіше додають у бажанки
                    </span>
                  }
                  title="Обране читачами"
                  sub="Книги, які читачі Knyhovo найчастіше додають до своїх бажанок."
                />
                <div className="cd-empty">
                  Тут з’являться книги, які читачі найчастіше додають до бажанок. Увійдіть та збережіть
                  першу книгу — і добірка оживе.
                </div>
              </section>
            )}

            {/* 3 · Що читати сьогодні — mood discovery (editorial break, sage band) */}
            {moods.length > 0 ? <MoodSection moods={moods} /> : null}

            {/* 4 · Популярне зараз — trending shelf (MINIMAL header: title + live status only) */}
            {popularItems.length > 0 ? (
              <BookSection
                id="populyarne"
                title="Популярне зараз"
                fresh={{ text: 'Оновлюється щогодини' }}
                allLabel="Уся добірка"
                allHref="/dobirky/populyarne-zaraz"
                items={popularItems}
              />
            ) : null}

            {/* 6 · Divider → Новинки місяця — new-arrivals shelf (NO description).
                «За жанром» grid removed 2026-07-04 (user decision): genre navigation
                lives only in the sticky nav's «Жанри» dropdown/sheet, which links
                straight to /zhanry/:slug. */}
            {novynkyItems.length > 0 ? (
              <>
                <SecDivider />
                <BookSection
                  id="novynky"
                  eyebrow="Свіже на полицях"
                  title="Новинки місяця"
                  fresh={{ text: 'Нові надходження' }}
                  allLabel="Усі новинки"
                  allHref="/dobirky/novynky"
                  items={novynkyItems}
                />
              </>
            ) : null}

            {/* 7 · Divider → Добірки редакції — weekly editorial collections (big cards).
                `FreshSection` already hides itself when `weekly` is empty. */}
            {weekly.length > 0 ? (
              <>
                <SecDivider />
                <FreshSection weekly={weekly} />
              </>
            ) : null}

            {/* 8 · Найбільші знижки — deals shelf (SHORT status, warm band) */}
            {znyzhkyItems.length > 0 ? (
              <BookSection
                id="znyzhky"
                band="warm"
                eyebrow="Вигідно зараз"
                title="Найбільші знижки"
                fresh={{ text: 'Ціни перевірено сьогодні' }}
                allLabel="Усі знижки"
                allHref="/dobirky/znyzhky"
                items={znyzhkyItems}
              />
            ) : null}

            {/* 9 · Недооцінені книги — hidden-gems editorial culmination (fanned cover trio) */}
            {gemsCovers.length > 0 ? <GemsBand fanCovers={gemsCovers} /> : null}
          </>
        )}
      </main>
    </>
  );
}
