-- Seed collection METADATA only (no books, no collection_items).
--
-- Staging already has real canonical_books/provider_listings (VIVAT,
-- LABORATORY, BOOK_CLUB, BOOKCHEF, KNIGOLAND), but the `collections` table is
-- empty there — the demo `seed.ts` script (which would also inject fake
-- books/collection_items) is never run against staging. Without at least
-- the DYNAMIC collection rows, `GET /api/collections/hub` has nothing to
-- read for the dynamic feeds even though their pools are computed live over
-- real books.
--
-- This migration inserts only the collection rows themselves:
--   * DYNAMIC rows — required; their book pools are computed at query time
--     over real canonical_books, so metadata alone is enough to serve real
--     books on staging.
--   * EDITORIAL (curated) and mood rows — inserted for completeness/parity
--     with local dev, but stay empty (no collection_items) until an editor
--     curates them; the hub already tolerates an absent/empty editorial
--     pool (see `buildHub`'s `featured: null` handling for the unseeded
--     case).
--
-- Idempotent via ON CONFLICT (slug) DO NOTHING — safe to run again, and safe
-- on a local DB that already ran the demo seed with these same slugs.
INSERT INTO "collections"
  ("id", "slug", "type", "name", "description", "icon", "display_order", "is_active", "updated_at")
VALUES
  -- Dynamic feeds
  ('col-najbilsh-bazhani', 'najbilsh-bazhani', 'dynamic', 'Обране читачами', 'Книги, які найчастіше додають у список бажаного.', 'heart', 1, true, CURRENT_TIMESTAMP),
  ('col-populyarne-zaraz', 'populyarne-zaraz', 'dynamic', 'Популярне зараз', 'Те, що зараз цікавить інших читачів найбільше.', 'flame', 2, true, CURRENT_TIMESTAMP),
  ('col-novynky', 'novynky', 'dynamic', 'Новинки', 'Найсвіжіші видання за останні 90 днів.', 'sparkle', 3, true, CURRENT_TIMESTAMP),
  ('col-znyzhky', 'znyzhky', 'dynamic', 'Найбільші знижки', 'Книги з найпомітнішим падінням ціни просто зараз.', 'percent', 4, true, CURRENT_TIMESTAMP),
  ('col-ponyzhena-tsina', 'ponyzhena-tsina', 'dynamic', 'Ціна щойно впала', 'Книги, що подешевшали за останній тиждень.', 'trending-down', 5, true, CURRENT_TIMESTAMP),
  ('col-rekordno-nyzka-tsina', 'rekordno-nyzka-tsina', 'dynamic', 'Рекордно низька ціна', 'Книги за найнижчою ціною за весь час спостережень.', 'badge-percent', 6, true, CURRENT_TIMESTAMP),

  -- Editorial (curated)
  ('col-knyhovyk-radyt', 'knyhovyk-radyt', 'editorial', 'Книговик радить', 'Тепла добірка від Книговика — те, що варто почитати саме зараз.', 'bookmark', 1, true, CURRENT_TIMESTAMP),
  ('col-buker-2026', 'buker-2026', 'editorial', 'Букерівський список 2026', 'Фіналісти й лауреати цьогорічної премії — усі в одному місці.', 'award', 2, true, CURRENT_TIMESTAMP),
  ('col-ukr-fentezi', 'ukr-fentezi', 'editorial', 'Українське фентезі, яке варто знати', 'Світи, магія й міфи — від українських і світових авторів.', 'swords', 3, true, CURRENT_TIMESTAMP),
  ('col-non-fikshn', 'non-fikshn', 'editorial', 'Нон-фікшн для довгих вечорів', 'Ідеї, що змінюють оптику — без поспіху й галасу.', 'lightbulb', 4, true, CURRENT_TIMESTAMP),
  ('col-pryhovani-skarby', 'pryhovani-skarby', 'editorial', 'Приховані скарби', 'Книги, які варті більшої уваги, ніж отримали.', 'gem', 5, true, CURRENT_TIMESTAMP),

  -- Moods (editorial, identified by the mood slug list)
  ('col-zatyshnyj-vechir', 'zatyshnyj-vechir', 'editorial', 'Для затишного вечора', 'Тепла проза, від якої не хочеться відриватись', 'coffee', 1, true, CURRENT_TIMESTAMP),
  ('col-pered-snom', 'pered-snom', 'editorial', 'Перед сном', 'Спокійні книги, що не тримають до ранку', 'moon', 2, true, CURRENT_TIMESTAMP),
  ('col-pryhody', 'pryhody', 'editorial', 'Якщо хочеться пригод', 'Сюжети, що зривають з місця', 'compass', 3, true, CURRENT_TIMESTAMP),
  ('col-vidpustka', 'vidpustka', 'editorial', 'Для відпустки', 'Легкі й захопливі — щоб узяти з собою', 'plane', 4, true, CURRENT_TIMESTAMP),
  ('col-natkhnennia', 'natkhnennia', 'editorial', 'Для натхнення', 'Книги, після яких хочеться діяти', 'lightbulb', 5, true, CURRENT_TIMESTAMP),
  ('col-korotki', 'korotki', 'editorial', 'Короткі книги на вечір', 'Прочитати за один присід', 'clock', 6, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
