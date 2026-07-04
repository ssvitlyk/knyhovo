import type { Metadata } from 'next';
import { getCollectionBooks, getCollectionsHub } from '@/lib/api/collections';
import type { CollectionBookCardDto, CollectionsHubDto } from '@/lib/api/types';
import { allocate } from '@/lib/collections/allocate';
import { shelfBadgeFor, type ShelfKind } from '@/lib/collections/badges';
import { buildCollectionPageJsonLd } from '@/lib/seo/collections-jsonld';
import { CollectionsNav } from '@/components/collections/CollectionsNav';
import { FeaturedCard } from '@/components/collections/FeaturedCard';
import { BookSection, SecDivider } from '@/components/collections/BookSection';
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

/** Cross-section dedup priority + shelf sizes (frozen mock's SECTION_POOLS). */
const SHELF_TAKES = { gems: 3, znyzhky: 5, obrane: 5, novynky: 5, popular: 5 } as const;

const SHELF_SLUGS: Readonly<Record<string, string>> = {
  obrane: 'najbilsh-bazhani',
  popular: 'populyarne-zaraz',
  novynky: 'novynky',
  znyzhky: 'znyzhky',
  gems: 'pryhovani-skarby',
};

async function booksOf(slug: string): Promise<readonly CollectionBookCardDto[]> {
  try {
    return (await getCollectionBooks({ slug, page: 1 })).books;
  } catch {
    return []; // degraded shelf — the section renders with what survived dedup
  }
}

function shelfItems(shelf: ShelfKind, books: readonly CollectionBookCardDto[]): ShelfItem[] {
  return books.map((book, index) => ({ book, badge: shelfBadgeFor(shelf, book, index) }));
}

/**
 * `/dobirky` — the Collections hub (SSR). Section order is frozen §6 minus the
 * «За жанром» grid (removed 2026-07-04, user decision — genres live in the nav):
 * hero → Обране читачами → mood band → Популярне зараз →
 * divider + Новинки місяця → divider + Добірки редакції → Найбільші знижки →
 * Недооцінені книги → footer. Books come from per-collection `:slug/books`
 * calls; the greedy allocate keeps every book on exactly one shelf.
 */
export default async function DobirkyPage(): Promise<React.JSX.Element> {
  let hub: CollectionsHubDto;
  try {
    hub = await getCollectionsHub();
  } catch {
    return (
      <main className="dobirky-scope">
        <BooksGridRetry />
      </main>
    );
  }

  const [obrane, popular, novynky, znyzhky, gems, ...weeklyBooks] = await Promise.all([
    booksOf(SHELF_SLUGS.obrane),
    booksOf(SHELF_SLUGS.popular),
    booksOf(SHELF_SLUGS.novynky),
    booksOf(SHELF_SLUGS.znyzhky),
    booksOf(SHELF_SLUGS.gems),
    ...hub.weekly.map((w) => booksOf(w.slug)),
  ]);

  const alloc = allocate<CollectionBookCardDto>([
    { key: 'gems', take: SHELF_TAKES.gems, pool: gems },
    { key: 'znyzhky', take: SHELF_TAKES.znyzhky, pool: znyzhky },
    { key: 'obrane', take: SHELF_TAKES.obrane, pool: obrane },
    { key: 'novynky', take: SHELF_TAKES.novynky, pool: novynky },
    { key: 'popular', take: SHELF_TAKES.popular, pool: popular },
  ]);

  const weekly: WeeklyCardData[] = hub.weekly.map((collection, i) => ({
    collection,
    covers: (weeklyBooks[i] ?? []).slice(0, 12).map((b) => ({ url: b.coverUrl, title: b.title })),
  }));

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

        {/* 1 · Hero — FROZEN featured block (editorial) */}
        <section className="sec sec--hero reveal">
          <FeaturedCard collection={hub.featured.collection} />
        </section>

        {/* 2 · Обране читачами — establishing discovery shelf (FULL header) */}
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
          items={shelfItems('obrane', alloc.obrane ?? [])}
        />

        {/* 3 · Що читати сьогодні — mood discovery (editorial break, sage band) */}
        <MoodSection moods={hub.moods} />

        {/* 4 · Популярне зараз — trending shelf (MINIMAL header: title + live status only) */}
        <BookSection
          id="populyarne"
          title="Популярне зараз"
          fresh={{ text: 'Оновлюється щогодини' }}
          allLabel="Уся добірка"
          allHref="/dobirky/populyarne-zaraz"
          items={shelfItems('popular', alloc.popular ?? [])}
        />

        {/* 6 · Divider → Новинки місяця — new-arrivals shelf (NO description).
            «За жанром» grid removed 2026-07-04 (user decision): genre navigation
            lives only in the sticky nav's «Жанри» dropdown/sheet, which links
            straight to /zhanry/:slug. */}
        <SecDivider />
        <BookSection
          id="novynky"
          eyebrow="Свіже на полицях"
          title="Новинки місяця"
          fresh={{ text: 'Додано цього тижня' }}
          allLabel="Усі новинки"
          allHref="/dobirky/novynky"
          items={shelfItems('novynky', alloc.novynky ?? [])}
        />

        {/* 7 · Divider → Добірки редакції — weekly editorial collections (big cards) */}
        <SecDivider />
        <FreshSection weekly={weekly} />

        {/* 8 · Найбільші знижки — deals shelf (SHORT status, warm band) */}
        <BookSection
          id="znyzhky"
          band="warm"
          eyebrow="Вигідно зараз"
          title="Найбільші знижки"
          fresh={{ text: 'Ціни перевірено сьогодні' }}
          allLabel="Усі знижки"
          allHref="/dobirky/znyzhky"
          items={shelfItems('znyzhky', alloc.znyzhky ?? [])}
        />

        {/* 9 · Недооцінені книги — hidden-gems editorial culmination (fanned cover trio) */}
        <GemsBand fanCovers={(alloc.gems ?? []).map((b) => b.coverUrl)} />
      </main>
    </>
  );
}
