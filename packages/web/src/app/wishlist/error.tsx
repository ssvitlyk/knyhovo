'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ds/Button';

/**
 * Route-level error boundary for the wishlist page. Covers API 5xx, transport
 * failures, and timeouts thrown by `getWishlist`. Offers a retry.
 */
export default function WishlistError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="wishlist">
      <div className="kn-error">
        <h3 className="kn-error__title">Не вдалося завантажити бажанки</h3>
        <p className="kn-error__text">
          Сталася помилка під час завантаження. Перевірте зʼєднання та спробуйте ще раз.
        </p>
        <Button variant="primary" onClick={() => reset()}>
          Спробувати ще раз
        </Button>
      </div>
    </main>
  );
}
