'use client';

import { HeaderSearchForm } from './HeaderSearchForm';

export interface MobileSearchOverlayProps {
  readonly onClose: () => void;
}

/**
 * Mobile search overlay (`.knh-so`) — dims the page, drops a full search bar
 * from the top. Autofocused; live suggestions flow inside the panel below the
 * field (so they can never overflow the viewport), submitting navigates to
 * `/search?q=…` and closes. Escape (once the dropdown is closed) and
 * body-scroll-lock are handled by the parent `MobileHeader`.
 */
export function MobileSearchOverlay({ onClose }: MobileSearchOverlayProps): React.JSX.Element {
  return (
    <div className="knh-so" role="dialog" aria-modal="true" aria-label="Пошук">
      <div className="knh-so__backdrop" onClick={onClose} />
      <HeaderSearchForm variant="mobile" autoFocusOnMount onNavigate={onClose} />
    </div>
  );
}
