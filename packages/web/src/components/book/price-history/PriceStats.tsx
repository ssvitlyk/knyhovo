import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { formatUah, formatRange, formatPercent } from '@/lib/priceHistory';
import type { PriceHistoryViewModel } from '@/lib/priceHistory';

export interface PriceStatsProps {
  readonly vm: PriceHistoryViewModel;
}

/**
 * Stat strip — 4 stats in frozen order: Зараз · Найнижча · Типова ціна · Зміна.
 * «Highest» is intentionally excluded per the v1.2.1 freeze.
 */
export function PriceStats({ vm }: PriceStatsProps): React.JSX.Element {
  const good = vm.current <= vm.usualLow;
  const down = vm.change < 0;
  const up = vm.change > 0;
  const chCls = down
    ? 'ph-stat__change--down'
    : up
      ? 'ph-stat__change--up'
      : 'ph-stat__change--flat';

  const ChangeIcon = down ? TrendingDown : up ? TrendingUp : Minus;

  return (
    <div className="ph-stats">
      <div className="ph-stat">
        <span className="ph-stat__label">Зараз</span>
        <span
          className={
            'ph-stat__val ' +
            (good ? 'ph-stat__val--now-good' : 'ph-stat__val--now')
          }
        >
          {formatUah(vm.current * 100)}
        </span>
      </div>
      <div className="ph-stat">
        <span className="ph-stat__label">Найнижча</span>
        <span className="ph-stat__val ph-stat__val--low">
          {formatUah(vm.low * 100)}
        </span>
      </div>
      <div className="ph-stat">
        <span className="ph-stat__label">Типова ціна</span>
        <span className="ph-stat__val ph-stat__val--typical">
          {formatRange(vm.usualLow * 100, vm.usualHigh * 100)}
        </span>
      </div>
      <div className="ph-stat">
        <span className="ph-stat__label">Зміна</span>
        <span className={`ph-stat__val ph-stat__change ${chCls}`}>
          <ChangeIcon size={20} aria-hidden />
          {formatPercent(vm.change)}
        </span>
      </div>
    </div>
  );
}
