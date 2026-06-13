/**
 * WishlistAuthRequired — shown when `GET /api/wishlist` returns 401.
 * Informs the user they need to log in. Login is out of scope for this sprint;
 * no active CTA is rendered to avoid dead links.
 */
export function WishlistAuthRequired(): React.JSX.Element {
  return (
    <div className="wl-auth-required">
      <h2 className="wl-auth-required__title">Увійдіть, щоб бачити свої бажанки</h2>
      <p className="wl-auth-required__text">
        Бажанки зберігаються у вашому обліковому записі. Щоб переглянути список &mdash;
        увійдіть або зареєструйтеся.
      </p>
      <p className="wl-auth-required__note">
        Вхід скоро з&apos;явиться у Knyhovo. Поки що скористайтеся пошуком, щоб знайти потрібні книги.
      </p>
    </div>
  );
}
