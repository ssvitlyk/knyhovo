import { BellDot, CheckCircle2, BellOff } from 'lucide-react';
import type { AlertUiState } from '@/lib/alerts';

/** AlertUiState variants that have a visible chip; 'saved' has no chip. */
export type AlertChipState = Exclude<AlertUiState, 'saved'>;

export interface AlertChipProps {
  /** The alert state to display. Must not be 'saved'. */
  state: AlertChipState;
}

/** Maps each chip state to its CSS suffix on `.al-chip--*`. */
const CHIP_SUFFIX: Readonly<Record<AlertChipState, string>> = {
  watch: 'watch',
  triggered: 'trig',
  paused: 'paused',
  unavailable: 'unavail',
};

/** Ukrainian label for each chip state. */
const CHIP_LABEL: Readonly<Record<AlertChipState, string>> = {
  watch: 'Стежимо за ціною',
  triggered: 'Ціль досягнута',
  paused: 'Призупинено',
  unavailable: 'Сповіщення недоступні',
};

/**
 * AlertChip — a quiet status pill shown in the wishlist row/card status
 * column and on Book Details. Purely presentational (no event handlers).
 * Colourblind-safe: glyph + label always present; colour is a secondary cue.
 */
export function AlertChip({ state }: AlertChipProps): React.JSX.Element {
  const suffix = CHIP_SUFFIX[state];
  const label = CHIP_LABEL[state];

  let icon: React.JSX.Element;
  switch (state) {
    case 'watch':
      icon = <BellDot size={13} aria-hidden />;
      break;
    case 'triggered':
      // Frozen chip glyph for the triggered state is a check-circle (target met),
      // distinct from the AlertBell's bell-ring control glyph.
      icon = <CheckCircle2 size={13} aria-hidden />;
      break;
    case 'paused':
    case 'unavailable':
      icon = <BellOff size={13} aria-hidden />;
      break;
  }

  return (
    <span className={`al-chip al-chip--${suffix}`}>
      {icon}
      {label}
    </span>
  );
}
