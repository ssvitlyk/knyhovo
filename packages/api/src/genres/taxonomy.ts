/**
 * Canonical Genre Taxonomy (genres-taxonomy PRD §6.1-6.2).
 *
 * Single source of truth for the 17 approved Knyhovo genres. Both the demo
 * `prisma/seed.ts` and the production `genres:sync` CLI (`genres/sync.ts`)
 * project this checked-in registry onto `collections` rows (type=TAXONOMIC),
 * so demo and production data can never diverge on genre content.
 *
 * `slug` is a live URL contract (`/zhanry/<slug>`) and is treated as
 * immutable — see PRD §6.4. Renaming a genre means changing only `name`;
 * `slug` never changes once shipped.
 */

/** A single canonical genre, checked-in and stable across environments. */
export interface CanonicalGenre {
  /** Stable slug, never renamed — backs the public `/zhanry/<slug>` URL. */
  readonly slug: string;
  /** English internal key (PRD §6.2), used for cross-referencing docs/reports. */
  readonly key: string;
  /** Ukrainian display name — freely renameable, does not affect `slug`. */
  readonly name: string;
  readonly description: string;
  /** Decorative icon slug (lucide icon name), shown in UI chips/cards. */
  readonly icon: string;
  readonly displayOrder: number;
  /**
   * Normalized alias strings (provider-agnostic fallback matching, PRD §4.3
   * step 1). Consumed by the future mapping engine (G3); G1 only stores them.
   */
  readonly aliases: readonly string[];
}

/** The 17 approved genres (PRD §6.2), in frozen display order. */
export const CANONICAL_GENRES: readonly CanonicalGenre[] = [
  {
    slug: 'fantastyka',
    key: 'science-fiction',
    name: 'Фантастика',
    description: 'Наукова фантастика та інші світи — від класики жанру до сучасних бестселерів.',
    icon: 'rocket',
    displayOrder: 1,
    aliases: ['sci-fi', 'science fiction', 'наукова фантастика'],
  },
  {
    slug: 'fentezi',
    key: 'fantasy',
    name: 'Фентезі',
    description: 'Магія, епічні саги та вигадані королівства для тих, хто любить втікати у інші світи.',
    icon: 'sparkles',
    displayOrder: 2,
    aliases: ['fantasy', 'фентезі'],
  },
  {
    slug: 'tryllery',
    key: 'thriller',
    name: 'Трилери',
    description: 'Напружені сюжети, що тримають у тонусі до останньої сторінки.',
    icon: 'knife',
    displayOrder: 3,
    aliases: ['thriller', 'трилер', 'саспенс'],
  },
  {
    slug: 'detektyvy',
    key: 'detective',
    name: 'Детективи',
    description: 'Класичні та сучасні розслідування — для тих, хто любить розгадувати загадки.',
    icon: 'search',
    displayOrder: 4,
    aliases: ['detective', 'детектив', 'кримінальний роман'],
  },
  {
    slug: 'zhahy',
    key: 'horror',
    name: 'Жахи',
    description: 'Історії, що лякають по-справжньому — від готичної класики до сучасного горору.',
    icon: 'ghost',
    displayOrder: 5,
    aliases: ['horror', 'горор'],
  },
  {
    slug: 'young-adult',
    key: 'young-adult',
    name: 'Young Adult',
    description: 'Романи для підлітків і не тільки — про дорослішання, дружбу та перше кохання.',
    icon: 'graduation-cap',
    displayOrder: 6,
    aliases: ['ya', 'підліткова література'],
  },
  {
    slug: 'klasyka',
    key: 'classics',
    name: 'Класика',
    description: 'Українська та світова класична література, що не втрачає актуальності.',
    icon: 'book-open',
    displayOrder: 7,
    aliases: ['classics', 'класична література'],
  },
  {
    slug: 'romantyka',
    key: 'romance',
    name: 'Романтика',
    description: 'Історії кохання — від легких сучасних романів до знакових класичних сюжетів.',
    icon: 'heart',
    displayOrder: 8,
    aliases: ['romance', 'любовні романи'],
  },
  {
    slug: 'samorozvytok',
    key: 'self-development',
    name: 'Саморозвиток',
    description: 'Практичні поради та ідеї для тих, хто прагне стати кращою версією себе.',
    icon: 'trending-up',
    displayOrder: 9,
    aliases: ['self-help', 'мотивація', 'особистісний розвиток'],
  },
  {
    slug: 'psykholohiia',
    key: 'psychology',
    name: 'Психологія',
    description: 'Про мислення, емоції та стосунки — від наукового підходу до практичних порад.',
    icon: 'brain',
    displayOrder: 10,
    aliases: ['psychology', 'психологія'],
  },
  {
    slug: 'biznes',
    key: 'business',
    name: 'Бізнес',
    description: 'Стратегії, історії успіху та інструменти для тих, хто будує свою справу.',
    icon: 'briefcase',
    displayOrder: 11,
    aliases: ['business', 'менеджмент', 'економіка'],
  },
  {
    slug: 'biohrafii',
    key: 'biography',
    name: 'Біографії',
    description: 'Життєписи видатних людей — натхнення на прикладах реальних доль.',
    icon: 'user',
    displayOrder: 12,
    aliases: ['biography', 'мемуари', 'автобіографія'],
  },
  {
    slug: 'dytiachi',
    key: 'children',
    name: 'Дитячі',
    description: 'Українська та світова класика для наймолодших читачів і їхніх батьків.',
    icon: 'baby',
    displayOrder: 13,
    aliases: ["children's books", 'дитяча література'],
  },
  {
    slug: 'komiksy',
    key: 'comics-manga',
    name: 'Комікси',
    description: 'Графічні романи та комікси — історії, розказані малюнком і словом.',
    icon: 'panels-top-left',
    displayOrder: 14,
    aliases: ['comics', 'manga', 'манга', 'графічні романи'],
  },
  {
    slug: 'istoriia',
    key: 'history',
    name: 'Історія',
    description: 'Про минуле України та світу — від давніх часів до новітньої історії.',
    icon: 'landmark',
    displayOrder: 15,
    aliases: ['history', 'історична література'],
  },
  {
    slug: 'naukovo-populiarni',
    key: 'popular-science',
    name: 'Науково-популярні',
    description: 'Наука простою мовою — про Всесвіт, мозок і природу навколо нас.',
    icon: 'flask-conical',
    displayOrder: 16,
    aliases: ['popular science', 'наук-поп', 'science'],
  },
  {
    slug: 'khudozhnia-proza',
    key: 'literary-fiction',
    name: 'Художня проза',
    description: 'Сучасна українська та світова проза — історії, що залишаються надовго.',
    icon: 'feather',
    displayOrder: 17,
    aliases: ['fiction', 'сучасна проза'],
  },
];
