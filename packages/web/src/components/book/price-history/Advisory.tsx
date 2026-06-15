import { buildAdvisory } from '@/lib/priceHistory';
import type { PriceHistoryViewModel } from '@/lib/priceHistory';

export interface AdvisoryProps {
  readonly vm: PriceHistoryViewModel;
}

/**
 * Advisory line — objective historical-context facts, never urgency.
 * Tone class drives emphasis colour only (good = green, high = neutral, calm = neutral).
 */
export function Advisory({ vm }: AdvisoryProps): React.JSX.Element {
  const advisory = buildAdvisory(vm);
  return (
    <p className={`ph-advisory ph-advisory--${advisory.tone}`}>
      {advisory.parts.map((part, i) =>
        typeof part === 'string' ? (
          <span key={i}>{part}</span>
        ) : (
          <b key={i}>{part.b}</b>
        ),
      )}
    </p>
  );
}
