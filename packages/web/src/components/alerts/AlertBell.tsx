import { Bell, BellDot, BellRing, BellOff } from 'lucide-react';
import type { AlertUiState } from '@/lib/alerts';

export interface AlertBellProps {
  /** The current alert UI state, which determines the glyph, tone modifier and disabled state. */
  state: AlertUiState;
  /** Click handler — omit when the button is purely decorative or wrapped by a parent. */
  onClick?: () => void;
  /** Icon size in pixels. Default: 18. */
  size?: number;
}

/** Maps each AlertUiState to its CSS tone modifier (or empty string for no modifier). */
const TONE: Readonly<Record<AlertUiState, string>> = {
  saved: '',
  watch: '',
  triggered: '--trig',
  paused: '--paused',
  unavailable: '--unavail',
};

/** Maps each AlertUiState to its Ukrainian aria-label. */
const ARIA_LABEL: Readonly<Record<AlertUiState, string>> = {
  saved: 'Сповістити про ціну',
  watch: 'Змінити сповіщення про ціну',
  triggered: 'Ціль досягнута — змінити сповіщення',
  paused: 'Сповіщення призупинено',
  unavailable: 'Сповіщення недоступні',
};

/**
 * AlertBell — the alert control icon-button. Five lifecycle states, four
 * distinct glyphs (saved/watch/triggered/paused/unavailable). Glyph and
 * aria-label always distinguish state; tone modifier is a secondary cue.
 * Disabled (non-interactive) when `state === 'unavailable'`.
 */
export function AlertBell({ state, onClick, size = 18 }: AlertBellProps): React.JSX.Element {
  const tone = TONE[state];
  const className = ['wl-iconbtn', tone ? `wl-iconbtn${tone}` : ''].filter(Boolean).join(' ');
  const ariaLabel = ARIA_LABEL[state];
  const isDisabled = state === 'unavailable';

  let icon: React.JSX.Element;
  switch (state) {
    case 'saved':
      icon = <Bell size={size} aria-hidden />;
      break;
    case 'watch':
      icon = <BellDot size={size} aria-hidden />;
      break;
    case 'triggered':
      icon = <BellRing size={size} aria-hidden />;
      break;
    case 'paused':
    case 'unavailable':
      icon = <BellOff size={size} aria-hidden />;
      break;
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      disabled={isDisabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
