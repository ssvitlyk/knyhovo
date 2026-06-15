import { PERIOD_ORDER, PERIOD_LABEL } from '@/lib/priceHistory';
import type { PeriodKey } from '@/lib/priceHistory';

export interface PeriodSelectorProps {
  readonly value: PeriodKey;
  readonly onChange: (key: PeriodKey) => void;
  /** When true, all chips are disabled (loading in-flight). */
  readonly disabled?: boolean;
}

/**
 * Period selector — DS chip-style tabs; no new control language.
 * Chips use role="tablist" / role="tab" per the frozen spec.
 */
export function PeriodSelector({
  value,
  onChange,
  disabled = false,
}: PeriodSelectorProps): React.JSX.Element {
  return (
    <div className="ph-periods" role="tablist" aria-label="Період">
      {PERIOD_ORDER.map((k) => (
        <button
          key={k}
          type="button"
          className="ph-period"
          data-on={value === k}
          role="tab"
          aria-selected={value === k}
          disabled={disabled}
          onClick={() => onChange(k)}
        >
          {PERIOD_LABEL[k]}
        </button>
      ))}
    </div>
  );
}
