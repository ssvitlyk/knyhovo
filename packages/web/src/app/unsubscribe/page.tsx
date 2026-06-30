import { unsubscribe } from '@/lib/api/notifications';
import { UnsubscribeConfirmation } from '@/components/settings/UnsubscribeConfirmation';

/**
 * Public unsubscribe page — performs the email opt-out via the backend token
 * and renders the frozen confirmation screen. Header/footer come from the root
 * layout. The backend endpoint is idempotent and non-enumerating, so the
 * confirmation is always shown regardless of the token's validity.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await searchParams;
  if (token) await unsubscribe(token);

  return <UnsubscribeConfirmation />;
}
