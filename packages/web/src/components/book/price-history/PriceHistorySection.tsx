'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Info } from 'lucide-react';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { getPriceHistory } from '@/lib/api/priceHistory';
import {
  toViewModel,
  DEFAULT_PERIOD_KEY,
  PERIOD_MAP,
} from '@/lib/priceHistory';
import type { PeriodKey, PriceHistoryViewModel } from '@/lib/priceHistory';
import type { PriceHistoryPeriod } from '@/lib/api/types';
import { PeriodSelector } from './PeriodSelector';
import { Advisory } from './Advisory';
import { PriceChart } from './PriceChart';
import { PriceStats } from './PriceStats';

export interface PriceHistorySectionProps {
  readonly bookId: string;
}

type Status = 'loading' | 'filled' | 'empty' | 'error';

/* ── Body-only skeleton (initial load + period switch) ─────────────────────
   Real chips above stay put; layout never shifts.                           */
function BodySkeleton(): React.JSX.Element {
  return (
    <>
      <div className="ph-sk-lines">
        <span
          className="ph-sk-block"
          style={{ width: '92%', maxWidth: 520, height: 13 }}
        />
        <span
          className="ph-sk-block"
          style={{ width: '54%', maxWidth: 320, height: 13 }}
        />
      </div>
      <div className="ph-card">
        <div className="ph-sk-chart">
          <span className="ph-sk-chart__band" />
          <span className="ph-sk-chart__axis">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} />
            ))}
          </span>
        </div>
        <div className="ph-stats">
          {([44, 84, 96, 56] as const).map((w, i) => (
            <div key={i} className="ph-stat">
              <span className="ph-sk-block" style={{ width: w, height: 11 }} />
              <span
                className="ph-sk-block"
                style={{
                  width: ([62, 62, 108, 72] as const)[i],
                  height: 24,
                  marginTop: 6,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Empty — "no history yet" ──────────────────────────────────────────────
   No period chips (W5 final freeze) — no data to switch between.           */
function EmptyBody(): React.JSX.Element {
  return (
    <div className="ph-empty">
      <div className="ph-empty__icon">
        <LineChart size={20} aria-hidden />
      </div>
      <div>
        <div className="ph-empty__titlerow">
          <span className="ph-empty__title">Ще збираємо історію</span>
          <Badge tone="neutral">Збираємо дані</Badge>
        </div>
        <p>
          Knyhovo перевіряє ціни щодня о 08:00. Книговик підкаже, коли
          настане вдалий момент купувати.
        </p>
      </div>
    </div>
  );
}

/* ── Error — local, calm, recoverable ─────────────────────────────────────
   Never hides offers, never a global page. No chips (W5 final freeze).     */
function ErrorBody({
  onRetry,
}: {
  readonly onRetry: () => void;
}): React.JSX.Element {
  return (
    <div className="ph-empty ph-empty--error" role="alert">
      <div className="ph-empty__icon">
        <Info size={20} aria-hidden />
      </div>
      <div>
        <div className="ph-empty__titlerow">
          <span className="ph-empty__title">
            Не вдалося завантажити динаміку цін
          </span>
        </div>
        <p>Спробуйте ще раз за кілька секунд. Решта інформації про книгу доступна нижче.</p>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Спробувати ще раз
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * PriceHistorySection — stateful orchestrator for the «Динаміка ціни» block.
 * Owns the loading → filled / empty / error state machine. Fetches the API
 * on mount (90d default) and on each period switch. Uses a stale-request guard
 * (reqRef counter) to drop late responses. The block never collapses.
 */
export function PriceHistorySection({
  bookId,
}: PriceHistorySectionProps): React.JSX.Element {
  const [periodKey, setPeriodKey] = useState<PeriodKey>(DEFAULT_PERIOD_KEY);
  const [status, setStatus] = useState<Status>('loading');
  const [vm, setVm] = useState<PriceHistoryViewModel | null>(null);
  const reqRef = useRef(0);

  function load(key: PeriodKey): void {
    const apiPeriod: PriceHistoryPeriod = PERIOD_MAP[key];
    setStatus('loading');
    const reqId = ++reqRef.current;

    getPriceHistory(bookId, apiPeriod)
      .then((dto) => {
        if (reqId !== reqRef.current) return; // ignore stale responses

        const points = dto && Array.isArray(dto.points) ? dto.points : [];
        if (points.length === 0) {
          setVm(null);
          setStatus('empty');
          return;
        }

        const model = toViewModel(dto);
        if (!model) {
          setStatus('error');
          return;
        }

        setVm(model);
        setStatus('filled');
      })
      .catch(() => {
        if (reqId !== reqRef.current) return;
        setStatus('error');
      });
  }

  useEffect(
    () => {
      void (async () => {
        const key = periodKey;
        const apiPeriod: PriceHistoryPeriod = PERIOD_MAP[key];
        const reqId = ++reqRef.current;

        try {
          const dto = await getPriceHistory(bookId, apiPeriod);
          if (reqId !== reqRef.current) return;

          const points = dto && Array.isArray(dto.points) ? dto.points : [];
          if (points.length === 0) {
            setVm(null);
            setStatus('empty');
            return;
          }

          const model = toViewModel(dto);
          if (!model) {
            setStatus('error');
            return;
          }

          setVm(model);
          setStatus('filled');
        } catch {
          if (reqId !== reqRef.current) return;
          setStatus('error');
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function onPeriod(key: PeriodKey): void {
    setPeriodKey(key);
    load(key);
  }

  function onRetry(): void {
    load(periodKey);
  }

  const showChips = status === 'filled' || status === 'loading';

  const titleH2 = (
    <h2
      className="ph-h2"
      style={showChips ? undefined : { marginBottom: 'var(--space-3)' }}
    >
      Динаміка ціни
    </h2>
  );

  const header = showChips ? (
    <div className="ph-head">
      {titleH2}
      <PeriodSelector
        value={periodKey}
        onChange={onPeriod}
        disabled={status === 'loading'}
      />
    </div>
  ) : (
    titleH2
  );

  let body: React.ReactNode;
  if (status === 'loading') {
    body = <BodySkeleton />;
  } else if (status === 'empty') {
    body = <EmptyBody />;
  } else if (status === 'error') {
    body = <ErrorBody onRetry={onRetry} />;
  } else if (vm) {
    body = (
      <>
        <Advisory vm={vm} />
        <div className="ph-card">
          <PriceChart vm={vm} />
          <PriceStats vm={vm} />
        </div>
      </>
    );
  }

  return (
    <section
      className="ph-section"
      data-ph-state={status}
      aria-busy={status === 'loading'}
    >
      {header}
      <div className="ph-swap" key={`${status}·${periodKey}`}>
        {body}
      </div>
    </section>
  );
}
