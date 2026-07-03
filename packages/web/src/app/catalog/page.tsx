import { cookies } from 'next/headers';
import { getCollectionsHome, CollectionsError } from '@/lib/api/collections';
import { CollectionsNav } from '@/components/collections/CollectionsNav';
import { FeaturedCard } from '@/components/collections/FeaturedCard';
import { BookSection } from '@/components/collections/BookSection';
import { MoodSection } from '@/components/collections/MoodSection';
import { FreshSection } from '@/components/collections/FreshSection';
import { GemsBand } from '@/components/collections/GemsBand';
import { CollectionIcon } from '@/components/collections/icons';
import { bestPriceIdOf } from '@/components/collections/badges';
import { catalogPath } from '@/lib/collectionsPaths';
import type {
  CollectionsHomeDto,
  CollectionSection,
  GenreDto,
  MoodDto,
  CollectionSummaryDto,
} from '@/lib/api/types';

// Auth-aware (wishlist state) + always-fresh catalog data — never statically cached.
export const dynamic = 'force-dynamic';

type BookSectionType = 'wishlist-popular' | 'new-arrivals' | 'biggest-discounts' | 'popular' | 'underrated';
type BookSectionDto = Extract<CollectionSection, { type: BookSectionType }>;
type GenresSectionDto = Extract<CollectionSection, { type: 'genres' }>;
type MoodsSectionDto = Extract<CollectionSection, { type: 'moods' }>;
type EditorialSectionDto = Extract<CollectionSection, { type: 'editorial' }>;

function findBookSection(home: CollectionsHomeDto, type: BookSectionType): BookSectionDto | undefined {
  return home.sections.find((s): s is BookSectionDto => s.type === type);
}
function findGenresSection(home: CollectionsHomeDto): GenresSectionDto | undefined {
  return home.sections.find((s): s is GenresSectionDto => s.type === 'genres');
}
function findMoodsSection(home: CollectionsHomeDto): MoodsSectionDto | undefined {
  return home.sections.find((s): s is MoodsSectionDto => s.type === 'moods');
}
function findEditorialSection(home: CollectionsHomeDto): EditorialSectionDto | undefined {
  return home.sections.find((s): s is EditorialSectionDto => s.type === 'editorial');
}

export default async function CatalogPage(): Promise<React.JSX.Element> {
  const cookie = (await cookies()).toString();

  let home: CollectionsHomeDto | null = null;
  let loadError: string | null = null;
  try {
    home = await getCollectionsHome({ cookie });
  } catch (error) {
    loadError = error instanceof CollectionsError ? error.message : 'Не вдалося завантажити добірки.';
  }

  const genres: readonly GenreDto[] = home ? (findGenresSection(home)?.items ?? []) : [];

  return (
    <>
      <CollectionsNav genres={genres} />
      <main>
        {home ? <CatalogHome home={home} /> : <CatalogShelvesError message={loadError ?? ''} />}
      </main>
    </>
  );
}

/** Renders the IA once the hub payload is available (frozen section order). */
function CatalogHome({ home }: { readonly home: CollectionsHomeDto }): React.JSX.Element {
  const wishlistPopular = findBookSection(home, 'wishlist-popular');
  const popular = findBookSection(home, 'popular');
  const newArrivals = findBookSection(home, 'new-arrivals');
  const biggestDiscounts = findBookSection(home, 'biggest-discounts');
  const moodsSection = findMoodsSection(home);
  const editorialSection = findEditorialSection(home);
  const underratedSection = findBookSection(home, 'underrated');

  const moods: readonly MoodDto[] = moodsSection?.items ?? [];
  const editorial: readonly CollectionSummaryDto[] = editorialSection?.items ?? [];

  return (
    <>
      {/* 1 · Hero — FROZEN featured block (editorial) */}
      <section className="sec sec--hero reveal">
        <div className="page">
          <FeaturedCard featured={home.featured} />
        </div>
      </section>

      {/* 2 · Обране читачами — establishing discovery shelf (FULL header) */}
      {wishlistPopular ? (
        <BookSection
          id="obrane"
          eyebrow={
            <span className="sec-eyebrow--rose">
              <CollectionIcon name="heart" size={13} /> {wishlistPopular.eyebrow ?? 'Найчастіше додають у бажанки'}
            </span>
          }
          title={wishlistPopular.title}
          sub={wishlistPopular.description}
          fresh={wishlistPopular.statusLabel ? { text: wishlistPopular.statusLabel } : null}
          allLabel="Усі улюблені"
          allHref={wishlistPopular.href}
          books={wishlistPopular.items}
          badgeKind="wishlist-count"
          returnTo={catalogPath()}
        />
      ) : null}

      {/* 3 · Що читати сьогодні — mood discovery (editorial break, sage band) */}
      {moods.length > 0 ? <MoodSection moods={moods} allHref={catalogPath()} /> : null}

      {/* 4 · Популярне зараз — trending shelf (MINIMAL header) */}
      {popular ? (
        <BookSection
          id="populyarne"
          title={popular.title}
          fresh={popular.statusLabel ? { text: popular.statusLabel } : null}
          allLabel="Уся добірка"
          allHref={popular.href}
          books={popular.items}
          badgeKind="trending"
          returnTo={catalogPath()}
        />
      ) : null}

      {/* 6 · Новинки місяця — new-arrivals shelf (NO description, cool band) */}
      {newArrivals ? (
        <BookSection
          id="novynky"
          band="cool"
          eyebrow="Свіже на полицях"
          title={newArrivals.title}
          fresh={newArrivals.statusLabel ? { text: newArrivals.statusLabel } : null}
          allLabel="Усі новинки"
          allHref={newArrivals.href}
          books={newArrivals.items}
          badgeKind="new"
          returnTo={catalogPath()}
        />
      ) : null}

      {/* 7 · Добірки редакції — weekly editorial collections (big cards) */}
      {editorial.length > 0 ? <FreshSection editorial={editorial} allHref={catalogPath()} /> : null}

      {/* 8 · Найбільші знижки — deals shelf (SHORT status, warm band) */}
      {biggestDiscounts ? (
        <BookSection
          id="znyzhky"
          band="warm"
          eyebrow="Вигідно зараз"
          title={biggestDiscounts.title}
          fresh={biggestDiscounts.statusLabel ? { text: biggestDiscounts.statusLabel } : null}
          allLabel="Усі знижки"
          allHref={biggestDiscounts.href}
          books={biggestDiscounts.items}
          badgeKind="discount"
          bestPriceId={bestPriceIdOf(biggestDiscounts.items)}
          returnTo={catalogPath()}
        />
      ) : null}

      {/* 9 · Недооцінені книги — hidden-gems editorial culmination (fanned cover trio) */}
      {underratedSection && underratedSection.items.length > 0 ? (
        <GemsBand
          title="Тихі книги, що варті гучної уваги"
          description="Те, що ще не знайшло свого читача — але точно на нього чекає. Книговик відкладає такі окремо."
          items={underratedSection.items}
          href={underratedSection.href}
        />
      ) : null}
    </>
  );
}

/** Local, region-scoped error/retry state for the shelves — header/nav/footer stay usable. */
function CatalogShelvesError({ message }: { readonly message: string }): React.JSX.Element {
  return (
    <section className="sec">
      <div className="page">
        <div className="cl-shelf-error">
          <h2 className="sec-title">Не вдалося завантажити добірки</h2>
          <p className="cl-shelf-error__text">{message || 'Перевірте зʼєднання та спробуйте оновити сторінку.'}</p>
          <a className="kn-btn kn-btn--secondary" href={catalogPath()}>
            Спробувати ще раз
          </a>
        </div>
      </div>
    </section>
  );
}
