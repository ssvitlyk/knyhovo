'use client';

import { HeaderSearchForm } from './HeaderSearchForm';

/**
 * Desktop search capsule (`.knh__search`) — a quiet part of the header, never
 * the dominant element. Live autocomplete drops under the capsule while typing;
 * submitting still navigates to the canonical `/search?q=…` route, and the
 * on-page SearchControl on `/search` is untouched and coexists with this.
 */
export function HeaderSearch(): React.JSX.Element {
  return <HeaderSearchForm variant="desktop" />;
}
