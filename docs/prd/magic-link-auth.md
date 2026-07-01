# PRD: Magic Link Auth (UI integration)

> Статус: Затверджено.
> Інтеграція затвердженого дизайну Magic Link Login (`packages/web/design-import/incoming`) поверх наявного auth-бекенду. Дизайн — джерело істини для UI. Реалізується після цього PRD.

## Business Goals

- Дати реальний вхід у Knyhovo (зараз кнопка «Увійти» неактивна), щоб розблокувати Wishlist та Notification Settings.
- Passwordless UX без тертя: email → лист із посиланням → клік → вхід.
- Зберегти користувача на сторінці, з якої він ініціював вхід (`returnTo`).

## Контекст і проблема

- **Дизайн** реалізує справжній **magic link** (клік по лінку в листі): екрани login / sending / success («Перевірте пошту») / error / invalid (протермінований лінк) / redirect («Входимо…») / auth-block. Екрана введення коду в дизайні немає.
- **Бекенд** наразі — **OTP (6-значний код)**: `POST /api/auth/request-code` + `POST /api/auth/verify-code`. Лінка / `returnTo` / реального листа немає (ConsoleMailer).
- **Frontend** не має UI-шару входу: `/login`, `/auth/verify`, `returnTo`, активної кнопки «Увійти».

## Зафіксовані рішення

- **Auth flow:** додаємо magic-link token поверх наявної session/cookie логіки. Web UI реалізує **тільки** magic link (без екрана коду). Наявний OTP **не видаляємо й не ламаємо** — лишається legacy/dev fallback.
- **Email:** реальний лист через **наявний Resend** (`RESEND_API_KEY` / `ALERT_FROM_EMAIL` / `ALERT_BASE_URL`); реюз існуючої mail-інфраструктури (`EmailSendClient` порт + factory-патерн). `ConsoleMailer` — лише dev/fallback за відсутності ключа.
- **Gating:** gated-сторінки лишають graceful auth-блоки (`AuthBlock`) + активна кнопка «Увійти»; **без** middleware-redirect у цьому скоупі.
- **returnTo:** валідується як internal-only path (починається з одного `/`, не `//`, без схеми/хоста); fallback `/`.
- **Design system:** заморожений DS v1 (чисті CSS-токени, Inter для body) — джерело істини для токенів; `.ml-*` стилі переносяться з дизайну. Нових залежностей немає (не shadcn/Tailwind).

## Що робимо

**Backend (additive, OTP недоторканий):**
- Модель `MagicLinkToken` (одноразовий random-токен, у БД лише SHA-256 hash, TTL, `consumedAt`, опційний `returnTo`).
- `POST /api/auth/magic-link {email, returnTo?}` — upsert user, rate-limit, gen token, надіслати лист із лінком.
- `POST /api/auth/verify-link {token}` — спожити токен, створити сесію, поставити cookie `kn_session`, повернути `{user, returnTo}`.
- Resend auth-mailer + email-template (pure render) + config + wiring у `server.ts`.
- Util `isSafeReturnTo`.

**Frontend:**
- `/login` (сторінка + модал з хедера) і `/auth/verify` (redirect/invalid стани) — один спільний `LoginForm`.
- `AuthBlock` для Wishlist/Settings із CTA «Увійти»→`/login?returnTo`.
- Активувати кнопку «Увійти» в `SiteHeader`.
- `.ml-*` стилі, auth-іконки, `auth.ts` wrappers (`requestMagicLink`, `verifyMagicLink`).

## Що НЕ робимо

- Email+password, OAuth, реєстрацію, мій-профіль.
- Екран введення OTP-коду (немає в дизайні).
- middleware-redirect для gated-сторінок.
- Видалення/зміну наявного OTP-флоу.
- Окремий новий mail-flow (реюз наявного Resend).

## Флоу

`/login` (email) → `POST /api/auth/magic-link` → лист із `${ALERT_BASE_URL}/auth/verify?token=…` → клік → web `/auth/verify` показує «Входимо…» і робить `POST /api/auth/verify-link` → API ставить cookie + повертає `{user, returnTo}` → client-redirect на валідований `returnTo` (fallback `/`). Невалідний/протермінований/спожитий токен → екран `invalid`.

## Acceptance Criteria

- Кнопка «Увійти» відкриває login (модал з хедера, сторінка `/login`), обидва — один компонент.
- Усі 7 станів дизайну реалізовано (login/sending/success/error/invalid/redirect/auth-block), toast «Посилання надіслано» лише на resend.
- Реальний лист надсилається через Resend (за наявності ключа); містить клікабельний magic link.
- Після кліку ставиться cookie `kn_session`; `GET /api/auth/me` повертає user; редірект на `returnTo`.
- `returnTo` що веде на зовнішній хост — відкидається (fallback `/`).
- Токен одноразовий: повторний клік → екран `invalid`.
- Наявний OTP-флоу та його тести лишаються зеленими.
- Покриття нових модулів ≥ 80% (unit + integration).

## Out of scope / майбутнє

- Merge анонімного localStorage-wishlist → акаунт (W0 з wishlist PRD).
- Повноцінна сторінка профілю / «Безпека та вхід».
