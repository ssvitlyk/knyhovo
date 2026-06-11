'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ds/Button';

/**
 * Route-level error boundary for the book details page. Covers API 5xx, transport
 * failures, and timeouts thrown by `getBookDetails`. Keeps the frozen warm tone and
 * offers a retry that re-runs the failed server render.
 */
export default function BookError({
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
    <main className="results">
      <div className="kn-error">
        <h3 className="kn-error__title">Не вдалося завантажити книгу</h3>
        <p className="kn-error__text">
          Сталася помилка під час завантаження книги. Перевірте зʼєднання та спробуйте ще раз.
        </p>
        <Button variant="primary" onClick={() => reset()}>
          Спробувати ще раз
        </Button>
      </div>
    </main>
  );
}
