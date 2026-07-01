import { AuthBlock } from '@/components/auth/AuthBlock';

/**
 * WishlistAuthRequired — shown when `GET /api/wishlist` returns 401. Renders the
 * frozen auth-required block with a CTA that routes to `/login?returnTo=/wishlist`.
 */
export function WishlistAuthRequired(): React.JSX.Element {
  return (
    <div className="ml-main">
      <AuthBlock context="wishlist" returnTo="/wishlist" />
    </div>
  );
}
