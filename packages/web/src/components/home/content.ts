/**
 * Homepage v1.0 — curated static content (the single data source for the
 * discovery shelves on `/`).
 *
 * The API has no popular/new-releases/recommendations endpoints, and
 * `SearchItemDto` carries no old price / discount / "Новинка" data — so the
 * frozen design's shelves are fed from this curated module. It is deliberately
 * isolated behind {@link HomeBook} + the exported arrays so a future API can
 * replace it without touching the shelf components (clean seam). Values mirror
 * the approved `design-import/incoming/homepage.jsx` mock catalog 1:1.
 */

/**
 * Badge spec on a shelf book. Frozen BookCard hierarchy, max one per card:
 * `green` → «Найкраща ціна», `solid:-N%` → discount, `accent:Новинка` → new.
 */
export type HomeBadge = 'green' | `solid:${string}` | `accent:${string}`;

export interface HomeBook {
  readonly title: string;
  readonly author: string;
  /** Pre-formatted price string, e.g. `"245 ₴"`. */
  readonly price: string;
  /** Pre-formatted old price (strikethrough) when discounted. */
  readonly oldPrice?: string | null;
  /** Store / provider display name (muted tertiary slot). */
  readonly store?: string | null;
  /** Cover image path under `public/`. */
  readonly cover?: string | null;
  readonly badge?: HomeBadge | null;
}

/** Hero popular-query chips → each navigates to `/search?q=…`. */
export const POPULAR_QUERIES: readonly string[] = [
  'Атомні звички',
  'Жадан',
  'Sapiens',
  'Кідрук',
  'Харарі',
];

/** «Популярне зараз» — price-driven discovery shelf. */
export const POPULAR_NOW: readonly HomeBook[] = [
  { title: 'Атомні звички', author: 'Джеймс Клір', price: '245 ₴', oldPrice: '320 ₴', store: 'Yakaboo', badge: 'green', cover: '/covers/atomni.png' },
  { title: 'Sapiens. Людина розумна', author: 'Ювал Ной Харарі', price: '380 ₴', oldPrice: '450 ₴', store: 'Rozetka', badge: 'solid:-16%', cover: '/covers/sapiens.png' },
  { title: 'Тонке мистецтво забивати на все', author: 'Марк Менсон', price: '240 ₴', oldPrice: '280 ₴', store: 'BookChef', badge: 'solid:-14%', cover: '/covers/tonke.png' },
  { title: '1984', author: 'Джордж Орвелл', price: '210 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: null, cover: '/covers/b1984.png' },
  { title: 'Гаррі Поттер і келих вогню', author: 'Дж. К. Ролінг', price: '410 ₴', oldPrice: '490 ₴', store: 'Yakaboo', badge: 'solid:-16%', cover: '/covers/harry.png' },
  { title: 'Думай повільно, вирішуй швидко', author: 'Деніел Канеман', price: '350 ₴', oldPrice: '420 ₴', store: 'Rozetka', badge: 'solid:-17%', cover: '/covers/dumai.png' },
  { title: 'Тореадори з Васюківки', author: 'Всеволод Нестайко', price: '230 ₴', oldPrice: null, store: 'BookChef', badge: null, cover: '/covers/toreadory.png' },
  { title: 'Лісова пісня', author: 'Леся Українка', price: '175 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'green', cover: '/covers/lisova.png' },
];

/** «Новинки» — fresh releases (accent «Новинка» badge). */
export const NEW_RELEASES: readonly HomeBook[] = [
  { title: 'Інтернат', author: 'Сергій Жадан', price: '210 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'accent:Новинка', cover: '/covers/internat.png' },
  { title: 'Той, хто відчиняє двері', author: 'Ілларіон Павлюк', price: '320 ₴', oldPrice: null, store: 'Yakaboo', badge: 'accent:Новинка', cover: '/covers/dveri.png' },
  { title: 'Дофамінове покоління', author: 'Анна Лембке', price: '365 ₴', oldPrice: null, store: 'BookChef', badge: 'accent:Новинка', cover: '/covers/dofamin.png' },
  { title: 'Доки світло не згасне назавжди', author: 'Макс Кідрук', price: '265 ₴', oldPrice: null, store: 'Nash Format', badge: 'accent:Новинка', cover: '/covers/svitlo.png' },
  { title: 'Доця', author: 'Тамара Горіха Зерня', price: '280 ₴', oldPrice: null, store: 'Yakaboo', badge: 'accent:Новинка', cover: '/covers/dotsia.png' },
  { title: 'Фелікс Австрія', author: 'Софія Андрухович', price: '300 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'accent:Новинка', cover: '/covers/feliks.png' },
  { title: 'За Перекопом є земля', author: 'Анастасія Левкова', price: '320 ₴', oldPrice: null, store: 'Nash Format', badge: 'accent:Новинка', cover: '/covers/perekop.png' },
  { title: 'Драбина', author: 'Євгенія Кузнєцова', price: '290 ₴', oldPrice: null, store: 'BookChef', badge: 'accent:Новинка', cover: '/covers/drabyna.png' },
];

/** «Книговик радить» — editorial curated shelf (books only). */
export const RECOMMENDS: readonly HomeBook[] = [
  { title: 'Сто років самотності', author: 'Ґабріель Ґарсіа Маркес', price: '285 ₴', oldPrice: '340 ₴', store: 'Yakaboo', badge: 'solid:-16%', cover: '/covers/sto-rokiv.png' },
  { title: 'Майстер і Маргарита', author: 'Михайло Булгаков', price: '220 ₴', oldPrice: '280 ₴', store: 'Rozetka', badge: 'solid:-21%', cover: '/covers/majster.png' },
  { title: 'Маленький принц', author: 'А. де Сент-Екзюпері', price: '185 ₴', oldPrice: null, store: 'Yakaboo', badge: 'green', cover: '/covers/pryntz.png' },
  { title: 'Кобзар', author: 'Тарас Шевченко', price: '165 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: null, cover: '/covers/kobzar.png' },
  { title: 'Тигролови', author: 'Іван Багряний', price: '210 ₴', oldPrice: '260 ₴', store: 'Yakaboo', badge: 'solid:-19%', cover: '/covers/tygrolovy.png' },
  { title: 'Тіні забутих предків', author: 'Михайло Коцюбинський', price: '160 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'green', cover: '/covers/tini.png' },
  { title: 'Енеїда', author: 'Іван Котляревський', price: '195 ₴', oldPrice: null, store: 'BookChef', badge: null, cover: '/covers/eneida.png' },
  { title: 'Місто', author: 'Валер’ян Підмогильний', price: '185 ₴', oldPrice: null, store: 'Rozetka', badge: null, cover: '/covers/misto.png' },
];
