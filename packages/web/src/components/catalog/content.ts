/**
 * Catalog v1.0 — curated static content (the single data source for the
 * `/catalog` curated-navigation landing).
 *
 * There are no collection/genre/author API endpoints yet, and `/api/search`
 * has no `?genre=` parameter — so the frozen `Collections Landing Page` sections
 * are fed from this curated module. It is deliberately isolated behind the
 * exported types + arrays so a future API (real collection pages, live counts,
 * genre filtering) can replace it without touching the section components
 * (clean seam). Values mirror the approved
 * `design-import/incoming/Collections Landing Page.html` mock 1:1.
 *
 * v1.0 navigation contract: every clickable card routes to `/search?q=<query>`
 * via {@link searchHref}. When real collection pages / `?genre=` arrive, only
 * the `href` values here change.
 */

/** Canonical search href for a curated query — the v1.0 navigation seam. */
export function searchHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

/** Hero editorial spotlight — the single Featured collection card. */
export interface FeaturedCollection {
  /** Eyebrow badge line, e.g. «Книговик радить · Редакційна добірка». */
  readonly badge: string;
  readonly title: string;
  readonly desc: string;
  /** Curated static book count. */
  readonly count: number;
  /** Gradient cover placeholder seeds (frozen `BookCover` hues). */
  readonly coverSeeds: readonly number[];
  readonly href: string;
}

/** «Актуальні добірки» — dynamic collection card (static seed counts in v1.0). */
export interface DynamicCollection {
  readonly slug: string;
  readonly name: string;
  readonly desc: string;
  readonly count: number;
  /** Short glyph rendered in the accent icon tile. */
  readonly icon: string;
  /** Icon tile background (DS color-mix expression). */
  readonly iconBg: string;
  readonly href: string;
}

/** «За жанром» — genre navigation card. */
export interface Genre {
  readonly slug: string;
  readonly name: string;
  readonly count: number;
  readonly emoji: string;
  readonly href: string;
}

/** «Curated» — editorial spotlight card. */
export interface EditorialItem {
  readonly slug: string;
  /** Editorial kind, e.g. «Книговик радить». */
  readonly type: string;
  readonly name: string;
  readonly desc: string;
  readonly count: number;
  /** Avatar image path under `public/` (Книговик) or `null` for a glyph. */
  readonly avatar?: string | null;
  /** Glyph shown when there is no avatar image. */
  readonly avatarLetter?: string | null;
  readonly href: string;
}

/** «Популярні автори» — author chip. */
export interface PopularAuthor {
  readonly slug: string;
  readonly name: string;
  readonly count: number;
  readonly href: string;
}

export const FEATURED: FeaturedCollection = {
  badge: 'Книговик радить · Редакційна добірка',
  title: 'Книги, що варто прочитати цього літа',
  desc:
    'Особиста підбірка Книговика — книги, які він перечитував, думав про них ' +
    'довго і нарешті рекомендує вголос. Від психологічних романів до нехудожньої прози.',
  count: 47,
  coverSeeds: [0, 3, 6],
  href: searchHref('Книговик радить'),
};

export const DYNAMIC_COLLECTIONS: readonly DynamicCollection[] = [
  { slug: 'populyarne-zaraz', name: 'Популярне зараз', desc: 'Оновлюється щодня', count: 147, icon: '🔥', iconBg: 'color-mix(in oklab, #B56A2D 12%, var(--bg))', href: searchHref('Популярне зараз') },
  { slug: 'novynky', name: 'Новинки', desc: 'З’явились цього місяця', count: 43, icon: '✦', iconBg: 'color-mix(in oklab, #243C7A 12%, var(--bg))', href: searchHref('Новинки') },
  { slug: 'znyzhky', name: 'Найбільші знижки', desc: 'Актуальні пропозиції', count: 62, icon: '%', iconBg: 'color-mix(in oklab, #24513E 12%, var(--bg))', href: searchHref('Найбільші знижки') },
  { slug: 'ponyzhena-tsina', name: 'Ціна знизилась', desc: 'За останні 7 днів', count: 31, icon: '↓', iconBg: 'color-mix(in oklab, #24513E 12%, var(--bg))', href: searchHref('Ціна знизилась') },
  { slug: 'najbilsh-bazhani', name: 'Найбільш бажані', desc: 'У вішлистах читачів', count: 89, icon: '♡', iconBg: 'color-mix(in oklab, #B56A2D 12%, var(--bg))', href: searchHref('Найбільш бажані') },
  { slug: 'rekordno-nyzka-tsina', name: 'Рекордна ціна', desc: 'Мінімум за всю історію', count: 18, icon: '★', iconBg: 'color-mix(in oklab, #243C7A 12%, var(--bg))', href: searchHref('Рекордна ціна') },
];

export const GENRES: readonly Genre[] = [
  { slug: 'fentezi', name: 'Фентезі', count: 612, emoji: '⚔️', href: searchHref('Фентезі') },
  { slug: 'psykholohiia', name: 'Психологія', count: 438, emoji: '🧠', href: searchHref('Психологія') },
  { slug: 'khudozhnia-proza', name: 'Художня проза', count: 1840, emoji: '📖', href: searchHref('Художня проза') },
  { slug: 'biznes', name: 'Бізнес', count: 327, emoji: '📊', href: searchHref('Бізнес') },
  { slug: 'naukova-fantastyka', name: 'Наукова фантастика', count: 289, emoji: '🚀', href: searchHref('Наукова фантастика') },
  { slug: 'istoriya', name: 'Історія', count: 514, emoji: '🏛️', href: searchHref('Історія') },
  { slug: 'dytiachi', name: 'Дитячі', count: 921, emoji: '🎨', href: searchHref('Дитячі') },
  { slug: 'nauka', name: 'Наука', count: 196, emoji: '🔬', href: searchHref('Наука') },
];

export const EDITORIAL: readonly EditorialItem[] = [
  {
    slug: 'knyhovyk-radyt',
    type: 'Книговик радить',
    name: 'Книги, що варто прочитати',
    desc:
      'Особиста добірка Книговика — книги, які він перечитував, думав про них ' +
      'довго і нарешті рекомендує вголос.',
    count: 47,
    avatar: '/mascot/avatarAtention.png',
    avatarLetter: null,
    href: searchHref('Книговик радить'),
  },
  {
    slug: 'vybir-redaktsiyi',
    type: 'Вибір редакції',
    name: 'Тема тижня: самотність і ті, хто поряд',
    desc:
      'Редакція Knyhovo обирає тему і збирає книги, що говорять про неї найчесніше. ' +
      'Цього тижня — про зв’язок.',
    count: 12,
    avatar: null,
    avatarLetter: '✦',
    href: searchHref('Вибір редакції'),
  },
  {
    slug: 'pryhovani-skarby',
    type: 'Приховані скарби',
    name: 'Малознані книги з великим серцем',
    desc:
      'Книги з рейтингом 4.5+ і менш ніж 200 оцінками. Те, що гідне уваги, ' +
      'але ще не знайшло свого читача.',
    count: 28,
    avatar: null,
    avatarLetter: '◈',
    href: searchHref('Приховані скарби'),
  },
];

export const AUTHORS: readonly PopularAuthor[] = [
  { slug: 'yuval-noa-kharari', name: 'Юваль Ноа Гарарі', count: 4, href: searchHref('Юваль Ноа Гарарі') },
  { slug: 'serhii-zhadan', name: 'Сергій Жадан', count: 12, href: searchHref('Сергій Жадан') },
  { slug: 'oksana-zabuzhko', name: 'Оксана Забужко', count: 8, href: searchHref('Оксана Забужко') },
  { slug: 'james-clear', name: 'Джеймс Клір', count: 3, href: searchHref('Джеймс Клір') },
  { slug: 'liuko-dashvar', name: 'Люко Дашвар', count: 7, href: searchHref('Люко Дашвар') },
  { slug: 'artem-chekh', name: 'Артем Чех', count: 5, href: searchHref('Артем Чех') },
  { slug: 'maryna-hrymych', name: 'Марина Гримич', count: 6, href: searchHref('Марина Гримич') },
  { slug: 'george-orwell', name: 'Джордж Оруелл', count: 5, href: searchHref('Джордж Оруелл') },
];
