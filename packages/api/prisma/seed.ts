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

/** Minimum live book count for a taxonomic (genre) collection to stay publicly browsable (catalog-v3 contract). */
const MIN_GENRE_BOOK_COUNT = 30;

// --- Genres (8, now TAXONOMIC collections) -----------------------------------
type GenreSeed = { slug: string; name: string; description: string; icon: string; displayOrder: number };
const GENRES: GenreSeed[] = [
  { slug: 'fantastyka', name: 'Фантастика', description: 'Наукова фантастика та інші світи — від класики жанру до сучасних бестселерів.', icon: 'rocket', displayOrder: 1 },
  { slug: 'fentezi', name: 'Фентезі', description: 'Магія, епічні саги та вигадані королівства для тих, хто любить втікати у інші світи.', icon: 'swords', displayOrder: 2 },
  { slug: 'tryllery', name: 'Трилери', description: 'Напружені сюжети, що тримають у тонусі до останньої сторінки.', icon: 'eye', displayOrder: 3 },
  { slug: 'detektyvy', name: 'Детективи', description: 'Класичні та сучасні розслідування — для тих, хто любить розгадувати загадки.', icon: 'search', displayOrder: 4 },
  { slug: 'zhahy', name: 'Жахи', description: 'Історії, що лякають по-справжньому — від готичної класики до сучасного горору.', icon: 'ghost', displayOrder: 5 },
  { slug: 'young-adult', name: 'Young Adult', description: 'Романи для підлітків і не тільки — про дорослішання, дружбу та перше кохання.', icon: 'sparkles', displayOrder: 6 },
  { slug: 'klasyka', name: 'Класика', description: 'Українська та світова класична література, що не втрачає актуальності.', icon: 'feather', displayOrder: 7 },
  { slug: 'romantyka', name: 'Романтика', description: 'Історії кохання — від легких сучасних романів до знакових класичних сюжетів.', icon: 'heart', displayOrder: 8 },
];

// --- Moods (6, now EDITORIAL collections identified by a constant slug list) -
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
// controls createdAt: <90 marks the book a "new arrival" (novynky window).
// `drop` seeds a 14-day-old higher price into price history (real drop, for
// znyzhky). `dropRecent` additionally seeds a 7-10-day-old higher price
// (recent drop, for ponyzhena-tsina — distinct from `drop`'s 14-day point).
type BookSeed = {
  n: number;
  title: string;
  author: string;
  isbn: string | null;
  genre: string | null;
  price: number; // current price, kopecks
  ageDays: number;
  outOfStock?: boolean;
  drop?: number; // 14-day-old higher price in kopecks; must be > price
  dropRecent?: number; // 7-10-day-old higher price in kopecks; must be > price
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

  // --- klasyka (need +15: have 15 -> 30) ---
  { n: 53, title: 'Захар Беркут', author: 'Іван Франко', isbn: '9786175856159', genre: 'klasyka', price: 17500, ageDays: 310 },
  { n: 54, title: 'Земля', author: 'Ольга Кобилянська', isbn: '9786175856166', genre: 'klasyka', price: 16500, ageDays: 330, dropRecent: 18800 },
  { n: 55, title: 'Хіба ревуть воли, як ясла повні?', author: 'Панас Мирний', isbn: '9786175856173', genre: 'klasyka', price: 18500, ageDays: 350 },
  { n: 56, title: 'Прапороносці', author: 'Олесь Гончар', isbn: '9786175856180', genre: 'klasyka', price: 20500, ageDays: 270 },
  { n: 57, title: 'Собор', author: 'Олесь Гончар', isbn: '9786175856197', genre: 'klasyka', price: 21500, ageDays: 280, drop: 27000 },
  { n: 58, title: 'Місто Лева', author: 'Наталена Королева', isbn: '9786175856203', genre: 'klasyka', price: 19000, ageDays: 305 },
  { n: 59, title: 'Дім на горі', author: 'Валерій Шевчук', isbn: '9786175856210', genre: 'klasyka', price: 22500, ageDays: 28 },
  { n: 60, title: 'Волинь', author: 'Улас Самчук', isbn: '9786175856227', genre: 'klasyka', price: 25500, ageDays: 275 },
  { n: 61, title: 'Марія', author: 'Улас Самчук', isbn: '9786175856234', genre: 'klasyka', price: 20000, ageDays: 355, drop: 25000 },
  { n: 62, title: 'Записки українського самашедшого', author: 'Ліна Костенко', isbn: '9786175856241', genre: 'klasyka', price: 23500, ageDays: 8 },
  { n: 63, title: 'Маруся Чурай', author: 'Ліна Костенко', isbn: '9786175856258', genre: 'klasyka', price: 21000, ageDays: 365 },
  { n: 64, title: 'Тигролови (ювілейне видання)', author: 'Іван Багряний', isbn: '9786175856265', genre: 'klasyka', price: 24500, ageDays: 12, outOfStock: true },
  { n: 65, title: 'Український декамерон', author: 'Богдан Лепкий', isbn: '9786175856272', genre: 'klasyka', price: 18000, ageDays: 300 },
  { n: 66, title: 'Кайдашева сім’я', author: 'Іван Нечуй-Левицький', isbn: '9786175856289', genre: 'klasyka', price: 15500, ageDays: 385, drop: 20000 },
  { n: 67, title: 'The Ukraine', author: 'Артем Чапай', isbn: '9786175856296', genre: 'klasyka', price: 22000, ageDays: 40 },

  // --- fantastyka (need +25: have 5 -> 30) ---
  { n: 68, title: 'Гіперіон', author: 'Ден Сіммонс', isbn: '9786177960431', genre: 'fantastyka', price: 33500, ageDays: 90, drop: 40000 },
  { n: 69, title: 'Падіння Гіперіона', author: 'Ден Сіммонс', isbn: '9786177960448', genre: 'fantastyka', price: 33500, ageDays: 92 },
  { n: 70, title: 'Задача трьох тіл', author: 'Лю Цисінь', isbn: '9786177960455', genre: 'fantastyka', price: 31500, ageDays: 19, dropRecent: 33000 },
  { n: 71, title: 'Темний ліс', author: 'Лю Цисінь', isbn: '9786177960462', genre: 'fantastyka', price: 32000, ageDays: 60, drop: 38000 },
  { n: 72, title: 'Кінець смерті', author: 'Лю Цисінь', isbn: '9786177960479', genre: 'fantastyka', price: 33000, ageDays: 45 },
  { n: 73, title: 'Дюна: Месія Дюни', author: 'Френк Герберт', isbn: '9786177960486', genre: 'fantastyka', price: 29500, ageDays: 200 },
  { n: 74, title: 'Діти Дюни', author: 'Френк Герберт', isbn: '9786177960493', genre: 'fantastyka', price: 30500, ageDays: 210, outOfStock: true },
  { n: 75, title: 'Гра Ендера', author: 'Орсон Скотт Кард', isbn: '9786177960509', genre: 'fantastyka', price: 27500, ageDays: 130, drop: 33500 },
  { n: 76, title: 'Голос тих, кого нема', author: 'Орсон Скотт Кард', isbn: '9786177960516', genre: 'fantastyka', price: 28000, ageDays: 140 },
  { n: 77, title: 'Нейромант', author: 'Вільям Ґібсон', isbn: '9786177960523', genre: 'fantastyka', price: 26500, ageDays: 250, dropRecent: 28400 },
  { n: 78, title: 'Снігопад', author: 'Ніл Стівенсон', isbn: '9786177960530', genre: 'fantastyka', price: 31000, ageDays: 22 },
  { n: 79, title: 'Автостопом по Галактиці', author: 'Дуглас Адамс', isbn: '9786177960547', genre: 'fantastyka', price: 21500, ageDays: 320, drop: 27000 },
  { n: 80, title: 'Реквієм за мрією… ні, Соляріс', author: 'Станіслав Лем', isbn: '9786177960554', genre: 'fantastyka', price: 20500, ageDays: 300 },
  { n: 81, title: 'Кіберіада', author: 'Станіслав Лем', isbn: '9786177960561', genre: 'fantastyka', price: 22500, ageDays: 290, outOfStock: true },
  { n: 82, title: 'Фаренгейт 451', author: 'Рей Бредбері', isbn: '9786177960578', genre: 'fantastyka', price: 18500, ageDays: 260, drop: 24000 },
  { n: 83, title: 'Марсіанські хроніки', author: 'Рей Бредбері', isbn: '9786177960585', genre: 'fantastyka', price: 19500, ageDays: 270 },
  { n: 84, title: 'Час зірок', author: 'Анджей Сапковський', isbn: '9786177960592', genre: 'fantastyka', price: 24500, ageDays: 6 },
  { n: 85, title: 'Червона зоря', author: 'Ліу Цисінь', isbn: '9786177960608', genre: 'fantastyka', price: 25500, ageDays: 175, outOfStock: true },
  { n: 86, title: 'Тау Кита', author: 'Кім Стенлі Робінсон', isbn: '9786177960615', genre: 'fantastyka', price: 29000, ageDays: 55, drop: 35500 },
  { n: 87, title: 'Червоний Марс', author: 'Кім Стенлі Робінсон', isbn: '9786177960622', genre: 'fantastyka', price: 30000, ageDays: 165 },
  { n: 88, title: 'Гіперболоїд інженера Ґаріна', author: 'Олексій Толстой', isbn: '9786177960639', genre: 'fantastyka', price: 17500, ageDays: 340 },
  { n: 89, title: 'Ложна сліпота', author: 'Пітер Воттс', isbn: '9786177960646', genre: 'fantastyka', price: 26000, ageDays: 15 },
  { n: 90, title: 'Плоский світ: Барва чарів', author: 'Террі Пратчетт', isbn: '9786177960653', genre: 'fantastyka', price: 23000, ageDays: 230, drop: 28500 },
  { n: 91, title: 'Сонм зірок', author: 'Артур Кларк', isbn: '9786177960660', genre: 'fantastyka', price: 22000, ageDays: 350 },
  { n: 92, title: 'Космічна одіссея 2001', author: 'Артур Кларк', isbn: '9786177960677', genre: 'fantastyka', price: 24000, ageDays: 25, outOfStock: true },

  // --- fentezi (need +24: have 6 -> 30) ---
  { n: 93, title: 'Гаррі Поттер і Таємна кімната', author: 'Джоан Роулінг', isbn: '9789667047108', genre: 'fentezi', price: 34500, ageDays: 11, dropRecent: 36600 },
  { n: 94, title: 'Гаррі Поттер і в’язень Азкабану', author: 'Джоан Роулінг', isbn: '9789667047115', genre: 'fentezi', price: 35000, ageDays: 10, drop: 41000 },
  { n: 95, title: 'Гаррі Поттер і келих вогню', author: 'Джоан Роулінг', isbn: '9789667047122', genre: 'fentezi', price: 37500, ageDays: 9 },
  { n: 96, title: 'Володар перснів: Братство персня', author: 'Джон Толкін', isbn: '9786177960684', genre: 'fentezi', price: 38500, ageDays: 300, drop: 45000 },
  { n: 97, title: 'Володар перснів: Дві вежі', author: 'Джон Толкін', isbn: '9786177960691', genre: 'fentezi', price: 38500, ageDays: 300 },
  { n: 98, title: 'Володар перснів: Повернення короля', author: 'Джон Толкін', isbn: '9786177960707', genre: 'fentezi', price: 39500, ageDays: 300, outOfStock: true },
  { n: 99, title: 'Гобіт, або Туди і звідти', author: 'Джон Толкін', isbn: '9786177960714', genre: 'fentezi', price: 27500, ageDays: 320 },
  { n: 100, title: 'Відьмак: Меч призначення', author: 'Анджей Сапковський', isbn: '9786177960721', genre: 'fentezi', price: 34500, ageDays: 70, drop: 41500 },
  { n: 101, title: 'Відьмак: Кров ельфів', author: 'Анджей Сапковський', isbn: '9786177960738', genre: 'fentezi', price: 35500, ageDays: 65, dropRecent: 37200 },
  { n: 102, title: 'Відьмак: Час погорди', author: 'Анджей Сапковський', isbn: '9786177960745', genre: 'fentezi', price: 35500, ageDays: 60, outOfStock: true },
  { n: 103, title: 'Ім’я вітру', author: 'Патрік Ротфусс', isbn: '9786177960752', genre: 'fentezi', price: 36500, ageDays: 40, drop: 43000 },
  { n: 104, title: 'Страхи мудреця', author: 'Патрік Ротфусс', isbn: '9786177960769', genre: 'fentezi', price: 37500, ageDays: 42 },
  { n: 105, title: 'Битва королів', author: 'Джордж Мартін', isbn: '9786177960776', genre: 'fentezi', price: 39500, ageDays: 13 },
  { n: 106, title: 'Буря мечів', author: 'Джордж Мартін', isbn: '9786177960783', genre: 'fentezi', price: 40500, ageDays: 17, drop: 47000 },
  { n: 107, title: 'Бенкет круків', author: 'Джордж Мартін', isbn: '9786177960790', genre: 'fentezi', price: 40500, ageDays: 20 },
  { n: 108, title: 'Мандрівний замок Хаула', author: 'Діана Вінн Джонс', isbn: '9786177960806', genre: 'fentezi', price: 26500, ageDays: 155, outOfStock: true },
  { n: 109, title: 'Тіні минулого', author: 'Робін Гобб', isbn: '9786177960813', genre: 'fentezi', price: 28500, ageDays: 185, drop: 34500 },
  { n: 110, title: 'Учнівська магія', author: 'Наомі Новік', isbn: '9786177960820', genre: 'fentezi', price: 25500, ageDays: 33, dropRecent: 27000 },
  { n: 111, title: 'Дев’яте королівство', author: 'Наомі Новік', isbn: '9786177960837', genre: 'fentezi', price: 26500, ageDays: 195 },
  { n: 112, title: 'Малазанська книга полеглих: Сад кісток', author: 'Стівен Еріксон', isbn: '9786177960844', genre: 'fentezi', price: 37500, ageDays: 240, outOfStock: true },
  { n: 113, title: 'Кров і попіл', author: 'Дженіфер Арментроут', isbn: '9786177960851', genre: 'fentezi', price: 27500, ageDays: 5, drop: 32500 },
  { n: 114, title: 'Двір шипів і троянд', author: 'Сара Дж. Маас', isbn: '9786177960868', genre: 'fentezi', price: 29500, ageDays: 7 },
  { n: 115, title: 'Двір туману й люті', author: 'Сара Дж. Маас', isbn: '9786177960875', genre: 'fentezi', price: 30500, ageDays: 4, drop: 36500 },
  { n: 116, title: 'Тронна кімната скла', author: 'Сара Дж. Маас', isbn: '9786177960882', genre: 'fentezi', price: 28500, ageDays: 175 },

  // --- tryllery (need +26: have 4 -> 30) ---
  { n: 117, title: 'Мовчання ягнят', author: 'Томас Гарріс', isbn: '9786177960899', genre: 'tryllery', price: 25500, ageDays: 260, drop: 31500, dropRecent: 27400 },
  { n: 118, title: 'Ганнібал', author: 'Томас Гарріс', isbn: '9786177960905', genre: 'tryllery', price: 26500, ageDays: 270 },
  { n: 119, title: 'Дівчина, яка гралася з вогнем', author: 'Стіг Ларссон', isbn: '9786177960912', genre: 'tryllery', price: 29500, ageDays: 100, outOfStock: true },
  { n: 120, title: 'Повітряний замок, який вибухнув', author: 'Стіг Ларссон', isbn: '9786177960929', genre: 'tryllery', price: 30500, ageDays: 105, drop: 37500 },
  { n: 121, title: 'Тихий Дон правди немає', author: 'Пола Гоукінз', isbn: '9786177960936', genre: 'tryllery', price: 24500, ageDays: 50 },
  { n: 122, title: 'У воді ти тонеш', author: 'Пола Гоукінз', isbn: '9786177960943', genre: 'tryllery', price: 25000, ageDays: 48, outOfStock: true },
  { n: 123, title: 'Гра в схованки', author: 'Гарлан Кобен', isbn: '9786177960950', genre: 'tryllery', price: 23500, ageDays: 90, drop: 29000 },
  { n: 124, title: 'Не кажи нікому', author: 'Гарлан Кобен', isbn: '9786177960967', genre: 'tryllery', price: 24000, ageDays: 95, dropRecent: 26300 },
  { n: 125, title: 'Дівчина в темряві', author: 'Ліза Гардинг', isbn: '9786177960974', genre: 'tryllery', price: 22500, ageDays: 35 },
  { n: 126, title: 'Кістки під снігом', author: 'Ілларіон Павлюк', isbn: '9786177960981', genre: 'tryllery', price: 27500, ageDays: 3, drop: 33500 },
  { n: 127, title: 'Танець недоумка', author: 'Ілларіон Павлюк', isbn: '9786177960998', genre: 'tryllery', price: 26500, ageDays: 60 },
  { n: 128, title: 'Пасажир', author: 'Ліса Лутц', isbn: '9786177961001', genre: 'tryllery', price: 21500, ageDays: 180, outOfStock: true },
  { n: 129, title: 'Спокуса невинності', author: 'А. Дж. Фінн', isbn: '9786177961018', genre: 'tryllery', price: 23000, ageDays: 200, drop: 28000 },
  { n: 130, title: 'Жінка у вікні', author: 'А. Дж. Фінн', isbn: '9786177961025', genre: 'tryllery', price: 23500, ageDays: 195 },
  { n: 131, title: 'Останнє алібі', author: 'Лі Чайлд', isbn: '9786177961032', genre: 'tryllery', price: 25500, ageDays: 20, dropRecent: 27200 },
  { n: 132, title: 'Ворог', author: 'Лі Чайлд', isbn: '9786177961049', genre: 'tryllery', price: 26000, ageDays: 145, drop: 31000 },
  { n: 133, title: 'Ще один день у раю', author: 'Девід Балдаччі', isbn: '9786177961056', genre: 'tryllery', price: 27000, ageDays: 75 },
  { n: 134, title: 'Абсолютна влада', author: 'Девід Балдаччі', isbn: '9786177961063', genre: 'tryllery', price: 27500, ageDays: 250, outOfStock: true },
  { n: 135, title: 'Тихий пацієнт', author: 'Алекс Міхаелідес', isbn: '9786177961070', genre: 'tryllery', price: 24500, ageDays: 27, drop: 30500 },
  { n: 136, title: 'Спадщина мовчання', author: 'Алекс Міхаелідес', isbn: '9786177961087', genre: 'tryllery', price: 25000, ageDays: 29 },
  { n: 137, title: 'Дар страху', author: 'Гарлан Кобен', isbn: '9786177961094', genre: 'tryllery', price: 24000, ageDays: 160 },
  { n: 138, title: 'Дощ у Мертвому місті', author: 'Ремі Джоу', isbn: '9786177961100', genre: 'tryllery', price: 22000, ageDays: 68, drop: 27500 },
  { n: 139, title: 'Диявол носить Prada, ні — темряву', author: 'Рут Вер', isbn: '9786177961117', genre: 'tryllery', price: 23500, ageDays: 115 },
  { n: 140, title: 'На краю обриву', author: 'Рут Вер', isbn: '9786177961124', genre: 'tryllery', price: 23500, ageDays: 118, outOfStock: true },
  { n: 141, title: 'Дзеркало для героя', author: 'Юрій Камаєв', isbn: '9786177961131', genre: 'tryllery', price: 21000, ageDays: 260 },
  { n: 142, title: 'Схованка', author: 'Гілліан Мак-Аллістер', isbn: '9786177961148', genre: 'tryllery', price: 22500, ageDays: 14, drop: 27000 },

  // --- detektyvy (need +27: have 3 -> 30) ---
  { n: 143, title: 'Пригоди Шерлока Холмса', author: 'Артур Конан Дойл', isbn: '9786177961155', genre: 'detektyvy', price: 21500, ageDays: 330, dropRecent: 23600 },
  { n: 144, title: 'Собака Баскервілів', author: 'Артур Конан Дойл', isbn: '9786177961162', genre: 'detektyvy', price: 19500, ageDays: 340, drop: 25000 },
  { n: 145, title: 'Етюд у багряних тонах', author: 'Артур Конан Дойл', isbn: '9786177961179', genre: 'detektyvy', price: 18500, ageDays: 350 },
  { n: 146, title: 'Загадка Ендхауза', author: 'Агата Крісті', isbn: '9786177961186', genre: 'detektyvy', price: 20500, ageDays: 210, outOfStock: true },
  { n: 147, title: 'Смерть на Нілі', author: 'Агата Крісті', isbn: '9786177961193', genre: 'detektyvy', price: 22500, ageDays: 160, drop: 27500 },
  { n: 148, title: 'Убивство в будинку вікарія', author: 'Агата Крісті', isbn: '9786177961209', genre: 'detektyvy', price: 20000, ageDays: 220 },
  { n: 149, title: 'І не лишилося жодного', author: 'Агата Крісті', isbn: '9786177961216', genre: 'detektyvy', price: 21000, ageDays: 230, outOfStock: true },
  { n: 150, title: 'Дівчина з паперовим ножем', author: 'Ю Несбьо', isbn: '9786177961223', genre: 'detektyvy', price: 26500, ageDays: 55, drop: 32000 },
  { n: 151, title: 'Сніговик', author: 'Ю Несбьо', isbn: '9786177961230', genre: 'detektyvy', price: 27000, ageDays: 90, dropRecent: 28700 },
  { n: 152, title: 'Привид', author: 'Ю Несбьо', isbn: '9786177961247', genre: 'detektyvy', price: 27500, ageDays: 130, outOfStock: true },
  { n: 153, title: 'Спляча красуня', author: 'Ю Несбьо', isbn: '9786177961254', genre: 'detektyvy', price: 26000, ageDays: 170, drop: 31500 },
  { n: 154, title: 'Дівчина у павутинні', author: 'Давід Лагеркранц', isbn: '9786177961261', genre: 'detektyvy', price: 28500, ageDays: 40 },
  { n: 155, title: 'Комісар Мегре і мертва людина', author: 'Жорж Сіменон', isbn: '9786177961278', genre: 'detektyvy', price: 17500, ageDays: 300, outOfStock: true },
  { n: 156, title: 'Мегре вагається', author: 'Жорж Сіменон', isbn: '9786177961285', genre: 'detektyvy', price: 17500, ageDays: 310, drop: 22000 },
  { n: 157, title: 'Кримінальне чтиво Кароліни', author: 'Кароліна Собчак', isbn: '9786177961292', genre: 'detektyvy', price: 19000, ageDays: 6 },
  { n: 158, title: 'Убивство у книгарні', author: 'Річард Осман', isbn: '9786177961308', genre: 'detektyvy', price: 24500, ageDays: 18, drop: 29500, dropRecent: 26600 },
  { n: 159, title: 'Клуб убивств по четвергах', author: 'Річард Осман', isbn: '9786177961315', genre: 'detektyvy', price: 24500, ageDays: 24 },
  { n: 160, title: 'Людина, яка померла двічі', author: 'Річард Осман', isbn: '9786177961322', genre: 'detektyvy', price: 25000, ageDays: 63, outOfStock: true },
  { n: 161, title: 'Дівчина, яка боялася', author: 'Карін Слотер', isbn: '9786177961339', genre: 'detektyvy', price: 23500, ageDays: 110, drop: 28500 },
  { n: 162, title: 'Гарна дочка', author: 'Карін Слотер', isbn: '9786177961346', genre: 'detektyvy', price: 23000, ageDays: 190 },
  { n: 163, title: 'Розтин', author: 'Патриція Корнвелл', isbn: '9786177961353', genre: 'detektyvy', price: 21000, ageDays: 240, outOfStock: true },
  { n: 164, title: 'Тіло в бібліотеці', author: 'Агата Крісті', isbn: '9786177961360', genre: 'detektyvy', price: 19500, ageDays: 280, drop: 24500 },
  { n: 165, title: 'Убивство Роджера Екройда', author: 'Агата Крісті', isbn: '9786177961377', genre: 'detektyvy', price: 20500, ageDays: 295 },
  { n: 166, title: 'Пастка для кішки', author: 'Люсі Фолі', isbn: '9786177961384', genre: 'detektyvy', price: 22500, ageDays: 32 },
  { n: 167, title: 'Гостина на Різдво', author: 'Люсі Фолі', isbn: '9786177961391', genre: 'detektyvy', price: 22500, ageDays: 9, drop: 27500 },
  { n: 168, title: 'Весілля', author: 'Люсі Фолі', isbn: '9786177961407', genre: 'detektyvy', price: 23000, ageDays: 47, outOfStock: true },
  { n: 169, title: 'Дівчина у скляній вежі', author: 'Джулія Кагава', isbn: '9786177961414', genre: 'detektyvy', price: 21500, ageDays: 155 },

  // --- zhahy (need +25: have 5 -> 30) ---
  { n: 170, title: 'Кладовище домашніх тварин 2', author: 'Стівен Кінг', isbn: '9786177961421', genre: 'zhahy', price: 28000, ageDays: 88, drop: 34000 },
  { n: 171, title: 'Керрі', author: 'Стівен Кінг', isbn: '9786177961438', genre: 'zhahy', price: 22500, ageDays: 250, dropRecent: 24200 },
  { n: 172, title: 'Мізері', author: 'Стівен Кінг', isbn: '9786177961445', genre: 'zhahy', price: 24500, ageDays: 195, outOfStock: true },
  { n: 173, title: 'Зелена миля', author: 'Стівен Кінг', isbn: '9786177961452', genre: 'zhahy', price: 26500, ageDays: 145, drop: 32500 },
  { n: 174, title: 'Протистояння', author: 'Стівен Кінг', isbn: '9786177961469', genre: 'zhahy', price: 35500, ageDays: 205 },
  { n: 175, title: 'Історія одного вбивства', author: 'Стівен Кінг', isbn: '9786177961476', genre: 'zhahy', price: 27000, ageDays: 40, outOfStock: true },
  { n: 176, title: 'Некрономікон', author: 'Говард Лавкрафт', isbn: '9786177961483', genre: 'zhahy', price: 20000, ageDays: 320, drop: 25500 },
  { n: 177, title: 'Заклик Ктулху', author: 'Говард Лавкрафт', isbn: '9786177961490', genre: 'zhahy', price: 19500, ageDays: 330 },
  { n: 178, title: 'Дракула', author: 'Брем Стокер', isbn: '9786177961506', genre: 'zhahy', price: 21000, ageDays: 355, outOfStock: true },
  { n: 179, title: 'Франкенштайн', author: 'Мері Шеллі', isbn: '9786177961513', genre: 'zhahy', price: 18500, ageDays: 365, drop: 23500 },
  { n: 180, title: 'Дім листя', author: 'Марк Данилевський', isbn: '9786177961520', genre: 'zhahy', price: 32500, ageDays: 30, dropRecent: 34000 },
  { n: 181, title: 'Тіні над Інсмутом', author: 'Говард Лавкрафт', isbn: '9786177961537', genre: 'zhahy', price: 19000, ageDays: 300, outOfStock: true },
  { n: 182, title: 'Той, хто ходить крізь стіни', author: 'Юрій Винничук', isbn: '9786177961544', genre: 'zhahy', price: 22500, ageDays: 15, drop: 27500 },
  { n: 183, title: 'Танго смерті', author: 'Юрій Винничук', isbn: '9786177961551', genre: 'zhahy', price: 23500, ageDays: 20 },
  { n: 184, title: 'Малий незнайомець', author: 'Сара Вотерс', isbn: '9786177961568', genre: 'zhahy', price: 24500, ageDays: 175, outOfStock: true },
  { n: 185, title: 'Реквієм по мрії кошмару', author: 'Клайв Баркер', isbn: '9786177961575', genre: 'zhahy', price: 25500, ageDays: 220, drop: 31000 },
  { n: 186, title: 'Книги крові', author: 'Клайв Баркер', isbn: '9786177961582', genre: 'zhahy', price: 26000, ageDays: 230 },
  { n: 187, title: 'Крик сови', author: 'Патриція Гайсміт', isbn: '9786177961599', genre: 'zhahy', price: 20500, ageDays: 255, outOfStock: true },
  { n: 188, title: 'Тихе місце', author: 'Джош Малерман', isbn: '9786177961605', genre: 'zhahy', price: 23000, ageDays: 45, drop: 28000, dropRecent: 25100 },
  { n: 189, title: 'Пташиний короб', author: 'Джош Малерман', isbn: '9786177961612', genre: 'zhahy', price: 23500, ageDays: 50 },
  { n: 190, title: 'Дім страху на пагорбі', author: 'Ширлі Джексон', isbn: '9786177961629', genre: 'zhahy', price: 21500, ageDays: 265, outOfStock: true },
  { n: 191, title: 'Ми завжди жили в замку', author: 'Ширлі Джексон', isbn: '9786177961636', genre: 'zhahy', price: 21000, ageDays: 275, drop: 26000 },
  { n: 192, title: 'Примара Гілл-хаусу', author: 'Ширлі Джексон', isbn: '9786177961643', genre: 'zhahy', price: 21500, ageDays: 285 },
  { n: 193, title: 'Незнайомці на потязі', author: 'Патриція Гайсміт', isbn: '9786177961650', genre: 'zhahy', price: 20000, ageDays: 295, outOfStock: true },
  { n: 194, title: 'Ловець снів', author: 'Стівен Кінг', isbn: '9786177961667', genre: 'zhahy', price: 27500, ageDays: 12, drop: 33000 },

  // --- young-adult (need +26: have 4 -> 30) ---
  { n: 195, title: 'Спалах', author: 'Джеймс Дашнер', isbn: '9786177961674', genre: 'young-adult', price: 24500, ageDays: 65, drop: 30000 },
  { n: 196, title: 'Лабіринт бігуна', author: 'Джеймс Дашнер', isbn: '9786177961681', genre: 'young-adult', price: 24500, ageDays: 70, dropRecent: 26200 },
  { n: 197, title: 'Дивовижний Оз', author: 'Ліман Френк Баум', isbn: '9786177961698', genre: 'young-adult', price: 18500, ageDays: 320, outOfStock: true },
  { n: 198, title: 'Персі Джексон і Викрадач блискавок', author: 'Рік Ріордан', isbn: '9786177961704', genre: 'young-adult', price: 25500, ageDays: 8, drop: 31500 },
  { n: 199, title: 'Персі Джексон і Море чудовиськ', author: 'Рік Ріордан', isbn: '9786177961711', genre: 'young-adult', price: 25500, ageDays: 13 },
  { n: 200, title: 'Дивергент', author: 'Вероніка Рот', isbn: '9786177961728', genre: 'young-adult', price: 26500, ageDays: 85, drop: 32500 },
  { n: 201, title: 'Інсургент', author: 'Вероніка Рот', isbn: '9786177961735', genre: 'young-adult', price: 26500, ageDays: 90 },
  { n: 202, title: 'Лоялiст', author: 'Вероніка Рот', isbn: '9786177961742', genre: 'young-adult', price: 27000, ageDays: 95, outOfStock: true },
  { n: 203, title: 'Полум’я і кров', author: 'Сюзанна Коллінз', isbn: '9786177961759', genre: 'young-adult', price: 28500, ageDays: 21, drop: 34500 },
  { n: 204, title: 'У вогні', author: 'Сюзанна Коллінз', isbn: '9786177961766', genre: 'young-adult', price: 27500, ageDays: 28, dropRecent: 29800 },
  { n: 205, title: 'Переспівниця', author: 'Сюзанна Коллінз', isbn: '9786177961773', genre: 'young-adult', price: 27500, ageDays: 33, outOfStock: true },
  { n: 206, title: 'Балада про змій і співочих пташок', author: 'Сюзанна Коллінз', isbn: '9786177961780', genre: 'young-adult', price: 29500, ageDays: 5, drop: 35500 },
  { n: 207, title: 'Зоряний вогонь', author: 'Тахере Мафі', isbn: '9786177961797', genre: 'young-adult', price: 25000, ageDays: 42 },
  { n: 208, title: 'Не торкайся мене', author: 'Тахере Мафі', isbn: '9786177961803', genre: 'young-adult', price: 25000, ageDays: 48, drop: 30500 },
  { n: 209, title: 'Червона королева', author: 'Вікторія Авеярд', isbn: '9786177961810', genre: 'young-adult', price: 26000, ageDays: 115 },
  { n: 210, title: 'Скляний меч', author: 'Вікторія Авеярд', isbn: '9786177961827', genre: 'young-adult', price: 26500, ageDays: 120, outOfStock: true },
  { n: 211, title: 'Шість воронів', author: 'Лі Бардуго', isbn: '9786177961834', genre: 'young-adult', price: 28500, ageDays: 16, drop: 34000 },
  { n: 212, title: 'Королівство шахраїв', author: 'Лі Бардуго', isbn: '9786177961841', genre: 'young-adult', price: 28500, ageDays: 19 },
  { n: 213, title: 'Тінь і кістка', author: 'Лі Бардуго', isbn: '9786177961858', genre: 'young-adult', price: 25500, ageDays: 135, outOfStock: true },
  { n: 214, title: 'Це ми', author: 'Дженніфер Ніван', isbn: '9786177961865', genre: 'young-adult', price: 24000, ageDays: 165, drop: 29000 },
  { n: 215, title: 'Ще одне слово про нас', author: 'Ніколь Кулаковські', isbn: '9786177961872', genre: 'young-adult', price: 22500, ageDays: 3 },
  { n: 216, title: 'П’ять неймовірних пригод', author: 'Дженні Хан', isbn: '9786177961889', genre: 'young-adult', price: 22000, ageDays: 25, drop: 27000 },
  { n: 217, title: 'Усім хлопцям, яких я любила', author: 'Дженні Хан', isbn: '9786177961896', genre: 'young-adult', price: 22500, ageDays: 58 },
  { n: 218, title: 'Легенда', author: 'Марі Лу', isbn: '9786177961902', genre: 'young-adult', price: 24500, ageDays: 185, outOfStock: true },
  { n: 219, title: 'Чудо', author: 'Р. Дж. Паласіо', isbn: '9786177961919', genre: 'young-adult', price: 21500, ageDays: 225, drop: 26500 },
  { n: 220, title: 'Аристотель і Данте досліджують таємниці всесвіту', author: 'Бенджамін Сієнс', isbn: '9786177961926', genre: 'young-adult', price: 23000, ageDays: 37 },

  // --- romantyka (need +25: have 5 -> 30) ---
  { n: 221, title: 'Емма', author: 'Джейн Остін', isbn: '9786177961933', genre: 'romantyka', price: 20500, ageDays: 330, drop: 26000 },
  { n: 222, title: 'Почуття і чутливість', author: 'Джейн Остін', isbn: '9786177961940', genre: 'romantyka', price: 20000, ageDays: 340 },
  { n: 223, title: 'Джейн Ейр', author: 'Шарлотта Бронте', isbn: '9786177961957', genre: 'romantyka', price: 21500, ageDays: 300, outOfStock: true },
  { n: 224, title: 'Буремний перевал', author: 'Емілі Бронте', isbn: '9786177961964', genre: 'romantyka', price: 20500, ageDays: 310, drop: 25500 },
  { n: 225, title: 'Червоне, біле і небесно-синє', author: 'Кейсі Маккуїстон', isbn: '9786177961971', genre: 'romantyka', price: 24500, ageDays: 11 },
  { n: 226, title: 'Люди, яких ми зустрічаємо у відпустці', author: 'Емілі Генрі', isbn: '9786177961988', genre: 'romantyka', price: 25500, ageDays: 6, drop: 31000 },
  { n: 227, title: 'Книжковий бойфренд', author: 'Емілі Генрі', isbn: '9786177961995', genre: 'romantyka', price: 25500, ageDays: 14 },
  { n: 228, title: 'Щасливий квиток', author: 'Емілі Генрі', isbn: '9786177962008', genre: 'romantyka', price: 26000, ageDays: 22, outOfStock: true },
  { n: 229, title: 'Сила семи почуттів', author: 'Коллін Гувер', isbn: '9786177962015', genre: 'romantyka', price: 24000, ageDays: 27, drop: 29500 },
  { n: 230, title: 'Це закінчується з нами', author: 'Коллін Гувер', isbn: '9786177962022', genre: 'romantyka', price: 25000, ageDays: 32 },
  { n: 231, title: 'Це починається з нас', author: 'Коллін Гувер', isbn: '9786177962039', genre: 'romantyka', price: 25500, ageDays: 34, outOfStock: true },
  { n: 232, title: 'Листи до Джульєтти', author: 'Коллін Гувер', isbn: '9786177962046', genre: 'romantyka', price: 23500, ageDays: 78, drop: 28500 },
  { n: 233, title: 'Сім чоловіків Евелін Юго', author: 'Тейлор Дженкінс Рід', isbn: '9786177962053', genre: 'romantyka', price: 24500, ageDays: 45, dropRecent: 26200 },
  { n: 234, title: 'Малібу цього літа', author: 'Тейлор Дженкінс Рід', isbn: '9786177962060', genre: 'romantyka', price: 24000, ageDays: 52, outOfStock: true },
  { n: 235, title: 'Останній лист від коханця', author: 'Джоджо Мойєс', isbn: '9786177962077', genre: 'romantyka', price: 23000, ageDays: 155, drop: 28000 },
  { n: 236, title: 'До зустрічі з тобою', author: 'Джоджо Мойєс', isbn: '9786177962084', genre: 'romantyka', price: 22500, ageDays: 165 },
  { n: 237, title: 'Після тебе', author: 'Джоджо Мойєс', isbn: '9786177962091', genre: 'romantyka', price: 22500, ageDays: 170, outOfStock: true },
  { n: 238, title: 'Норвезький ліс', author: 'Харукі Муракамі', isbn: '9786177962107', genre: 'romantyka', price: 24500, ageDays: 210, drop: 30000 },
  { n: 239, title: 'Кафка на пляжі', author: 'Харукі Муракамі', isbn: '9786177962114', genre: 'romantyka', price: 25500, ageDays: 220 },
  { n: 240, title: 'Прекрасні світи, де ви є', author: 'Саллі Руні', isbn: '9786177962121', genre: 'romantyka', price: 26500, ageDays: 40, outOfStock: true },
  { n: 241, title: 'Мій рік спокою і відпочинку', author: 'Оттесса Мошфег', isbn: '9786177962138', genre: 'romantyka', price: 23500, ageDays: 60, drop: 28500 },
  { n: 242, title: 'Червоний острів кохання', author: 'Тахмія Анам', isbn: '9786177962145', genre: 'romantyka', price: 21500, ageDays: 130 },
  { n: 243, title: 'Провина закоханих', author: 'Ніколас Спаркс', isbn: '9786177962152', genre: 'romantyka', price: 22000, ageDays: 245, outOfStock: true },
  { n: 244, title: 'Щоденник пам’яті', author: 'Ніколас Спаркс', isbn: '9786177962169', genre: 'romantyka', price: 21500, ageDays: 255, drop: 26500 },
  { n: 245, title: 'В обіймах шторму', author: 'Ніколас Спаркс', isbn: '9786177962176', genre: 'romantyka', price: 22000, ageDays: 260 },
];

async function main(): Promise<void> {
  const now = new Date();

  // --- Genres (TAXONOMIC collections) ----------------------------------------
  const genreIdBySlug = new Map<string, string>();
  for (const g of GENRES) {
    const row = await prisma.collection.upsert({
      where: { slug: g.slug },
      update: {
        type: CollectionType.TAXONOMIC,
        name: g.name,
        description: g.description,
        icon: g.icon,
        displayOrder: g.displayOrder,
        isActive: true,
      },
      create: {
        slug: g.slug,
        type: CollectionType.TAXONOMIC,
        name: g.name,
        description: g.description,
        icon: g.icon,
        displayOrder: g.displayOrder,
        isActive: true,
      },
    });
    genreIdBySlug.set(g.slug, row.id);
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

      // Price history: on the primary listing, seed a real 14-day-old drop
      // when defined (znyzhky candidates), and/or a 7-10-day-old drop
      // (ponyzhena-tsina candidates — recent-window fall).
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
      if (li === 0 && b.dropRecent && b.dropRecent > b.price) {
        historySeq += 1;
        // 7-10 days ago, varied by book number so points aren't all identical.
        const daysAgo = 7 + (b.n % 4);
        historyRows.push({
          id: historyId(historySeq),
          providerListingId: listing.id,
          priceAmount: b.dropRecent,
          priceCurrency: Currency.UAH,
          availability: Availability.IN_STOCK,
          recordedAt: new Date(now.getTime() - daysAgo * DAY_MS),
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

  // --- Editorial collections (featured + editorial + weekly) ----------------
  type CollectionSeed = {
    slug: string;
    name: string;
    description: string;
    icon: string | null;
    displayOrder: number;
    bookNs: number[];
  };
  const COLLECTIONS: CollectionSeed[] = [
    {
      slug: 'knyhovyk-radyt',
      name: 'Книговик радить',
      description: 'Тепла добірка від Книговика — те, що варто почитати саме зараз.',
      icon: 'bookmark',
      displayOrder: 1,
      bookNs: [16, 26, 28, 12, 40, 13, 51, 3, 10, 30, 43, 17],
    },
    {
      slug: 'buker-2026',
      name: 'Букерівський список 2026',
      description: 'Фіналісти й лауреати цьогорічної премії — усі в одному місці.',
      icon: 'award',
      displayOrder: 2,
      bookNs: [16, 15, 5, 4, 18, 19, 21, 8, 9, 10, 44, 51],
    },
    {
      slug: 'ukr-fentezi',
      name: 'Українське фентезі, яке варто знати',
      description: 'Світи, магія й міфи — від українських і світових авторів.',
      icon: 'swords',
      displayOrder: 3,
      bookNs: [17, 25, 26, 27, 46, 47, 48, 28, 14, 20, 11, 22],
    },
    {
      slug: 'non-fikshn',
      name: 'Нон-фікшн для довгих вечорів',
      description: 'Ідеї, що змінюють оптику — без поспіху й галасу.',
      icon: 'lightbulb',
      displayOrder: 4,
      bookNs: [4, 3, 7, 5, 6, 18, 16, 8, 9, 14, 44, 51],
    },
    {
      slug: 'pryhovani-skarby',
      name: 'Приховані скарби',
      description: 'Книги, які варті більшої уваги, ніж отримали.',
      icon: 'gem',
      displayOrder: 5,
      bookNs: [21, 22, 23, 24, 20, 14, 33, 50, 47, 42, 11, 30],
    },
  ];

  for (const c of COLLECTIONS) {
    const collection = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {
        type: CollectionType.EDITORIAL,
        name: c.name,
        description: c.description,
        icon: c.icon,
        displayOrder: c.displayOrder,
        isActive: true,
      },
      create: {
        slug: c.slug,
        type: CollectionType.EDITORIAL,
        name: c.name,
        description: c.description,
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
    name: string;
    description: string;
    icon: string | null;
    displayOrder: number;
  };
  const DYNAMIC_COLLECTIONS: DynamicSeed[] = [
    {
      slug: 'najbilsh-bazhani',
      name: 'Обране читачами',
      description: 'Книги, які найчастіше додають у список бажаного.',
      icon: 'heart',
      displayOrder: 1,
    },
    {
      slug: 'populyarne-zaraz',
      name: 'Популярне зараз',
      description: 'Те, що зараз цікавить інших читачів найбільше.',
      icon: 'flame',
      displayOrder: 2,
    },
    {
      slug: 'novynky',
      name: 'Новинки',
      description: 'Найсвіжіші видання за останні 90 днів.',
      icon: 'sparkle',
      displayOrder: 3,
    },
    {
      slug: 'znyzhky',
      name: 'Найбільші знижки',
      description: 'Книги з найпомітнішим падінням ціни просто зараз.',
      icon: 'percent',
      displayOrder: 4,
    },
    {
      slug: 'ponyzhena-tsina',
      name: 'Ціна щойно впала',
      description: 'Книги, що подешевшали за останній тиждень.',
      icon: 'trending-down',
      displayOrder: 5,
    },
    {
      slug: 'rekordno-nyzka-tsina',
      name: 'Рекордно низька ціна',
      description: 'Книги за найнижчою ціною за весь час спостережень.',
      icon: 'badge-percent',
      displayOrder: 6,
    },
  ];

  for (const d of DYNAMIC_COLLECTIONS) {
    await prisma.collection.upsert({
      where: { slug: d.slug },
      update: {
        type: CollectionType.DYNAMIC,
        name: d.name,
        description: d.description,
        icon: d.icon,
        displayOrder: d.displayOrder,
        isActive: true,
      },
      create: {
        slug: d.slug,
        type: CollectionType.DYNAMIC,
        name: d.name,
        description: d.description,
        icon: d.icon,
        displayOrder: d.displayOrder,
        isActive: true,
      },
    });
  }

  // --- Mood collections (EDITORIAL, identified by MOOD_SLUGS) + linked books -
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
        type: CollectionType.EDITORIAL,
        name: m.name,
        description: m.description,
        icon: m.icon,
        displayOrder: m.displayOrder,
        isActive: true,
      },
      create: {
        slug: m.slug,
        type: CollectionType.EDITORIAL,
        name: m.name,
        description: m.description,
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

  const newArrivals = BOOKS.filter((b) => b.ageDays < 90).length;
  const withDrop = BOOKS.filter((b) => b.drop).length;
  const withRecentDrop = BOOKS.filter((b) => b.dropRecent).length;
  const outOfStock = BOOKS.filter((b) => b.outOfStock).length;

  console.log('Seed completed:');
  console.log(`  genres (taxonomic collections): ${GENRES.length}`);
  console.log(`  moods (editorial collections): ${MOODS.length}`);
  console.log(`  canonical_books: ${BOOKS.length} (${newArrivals} new arrivals <90d, ${outOfStock} out-of-stock)`);
  console.log(`  provider_listings: ${listingSeq}`);
  console.log(
    `  price_history: ${historyRows.length} points (${withDrop} books w/ 14d drop, ${withRecentDrop} w/ 7-10d recent drop)`,
  );
  console.log(`  users: ${user.email}`);
  console.log(`  wishlist_items: ${wishlistBookNs.length} (alert on Кобзар: BELOW_CURRENT, target 200 UAH)`);
  console.log(`  editorial_collections: ${COLLECTIONS.length} (${COLLECTIONS.reduce((s, c) => s + c.bookNs.length, 0)} items)`);
  console.log(`  dynamic_collections: ${DYNAMIC_COLLECTIONS.length} (metadata only, no items)`);
  console.log(
    `  mood_collections: ${MOODS.length} (${Object.values(MOOD_BOOK_NS).reduce((s, ns) => s + ns.length, 0)} items)`,
  );

  console.log('  per-genre book counts:');
  let anyThin = false;
  for (const g of GENRES) {
    const count = BOOKS.filter((b) => b.genre === g.slug).length;
    const flag = count < MIN_GENRE_BOOK_COUNT ? ' ⚠️  BELOW MINIMUM' : '';
    if (count < MIN_GENRE_BOOK_COUNT) anyThin = true;
    console.log(`    ${g.slug}: ${count}${flag}`);
  }
  if (anyThin) {
    console.warn(`WARN: one or more genres have fewer than ${MIN_GENRE_BOOK_COUNT} books.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
