import { cookies } from 'next/headers';
import { getWishlist } from '@/lib/api/wishlist';
import { WishlistView } from '@/components/wishlist/WishlistView';
import { WishlistAuthRequired } from '@/components/wishlist/WishlistAuthRequired';

/**
 * Wishlist page — server component. Reads the session cookie and fetches
 * the wishlist from the API. Renders an auth-required state on 401; otherwise
 * passes items to the WishlistView client/server composition.
 */
export default async function WishlistPage(): Promise<React.JSX.Element> {
  const cookie = (await cookies()).toString();
  const result = await getWishlist({ cookie });

  return (
    <main className="wishlist">
      {'unauthorized' in result ? (
        <WishlistAuthRequired />
      ) : (
        <WishlistView items={result.items} />
      )}
    </main>
  );
}
