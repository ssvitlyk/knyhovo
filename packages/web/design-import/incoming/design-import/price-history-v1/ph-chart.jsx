// Knyhovo · Price History extension (W3) — CHART + period selector + stats
// + empty/loading states. Calm, advisory, readable. NOT trading aesthetics.
// Depends on window.PHData + window.KnyhovoDesignSystem_9fa616. Exports window.PHChart.
'use strict';

const PHC = window.PHData;
const PHC_DS = window.KnyhovoDesignSystem_9fa616;

/* ── Geometry: build a calm, gently-smoothed line + "usual range" band ───── */
function phGeom(series, W, H, pad) {
  const { padL, padR, padT, padB } = pad;
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB;
  const prices = series.points.map((d) => d.p).concat([series.usualLow, series.usualHigh]);
  const dMin = Math.min(...prices), dMax = Math.max(...prices);
  const span = Math.max(1, dMax - dMin);
  const m = span * 0.12;                       // soft headroom
  const lo = dMin - m, hi = dMax + m;
  const x = (i) => x0 + (x1 - x0) * (series.points.length === 1 ? 0.5 : i / (series.points.length - 1));
  const y = (p) => y1 - (y1 - y0) * ((p - lo) / (hi - lo));
  const pts = series.points.map((d, i) => ({ x: x(i), y: y(d.p), p: d.p, label: d.x }));

  // gentle smoothing — horizontal-tangent cubic through midpoints (organic, calm)
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], mx = (a.x + b.x) / 2;
    line += ` C ${mx.toFixed(1)} ${a.y.toFixed(1)} ${mx.toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const area = line + ` L ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x0.toFixed(1)} ${y1.toFixed(1)} Z`;

  const maxIdx = pts.reduce((mi, p, i) => (p.p > pts[mi].p ? i : mi), 0);
  return {
    x0, x1, y0, y1, line, area, pts,
    bandTop: y(series.usualHigh), bandBot: y(series.usualLow),
    current: pts[pts.length - 1], peak: pts[maxIdx], uid: 'g' + Math.round(Math.random() * 1e6),
  };
}

/* ── The chart SVG ───────────────────────────────────────────────────────── */
function PriceChart({ seriesKey, series: seriesProp, mobile }) {
  const series = seriesProp || PHC.SERIES[seriesKey];
  const W = mobile ? 340 : 760, H = mobile ? 168 : 244;
  const pad = mobile
    ? { padL: 10, padR: 60, padT: 24, padB: 28 }
    : { padL: 14, padR: 92, padT: 26, padB: 30 };
  const g = phGeom(series, W, H, pad);
  const good = series.current <= series.usualLow;       // below usual = good moment
  const curColor = good ? 'var(--brand-green)' : 'var(--accent)';

  return (
    <svg className="ph-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Динаміка ціни за ${series.label}. Зараз ${series.current} ₴, найнижча ${series.low} ₴. Типовий діапазон ${series.usualLow}–${series.usualHigh} ₴.`}>
      <defs>
        <linearGradient id={g.uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: curColor }} stopOpacity="0.16"></stop>
          <stop offset="1" style={{ stopColor: curColor }} stopOpacity="0"></stop>
        </linearGradient>
      </defs>

      {/* “Typical price range” band — answers "is this a typical price?". A subtle,
         low-contrast zone (not a single reference line). Communicates "this is
         where the book usually lives", never "the one correct price". */}
      <rect className="ph-band" x={g.x0} y={g.bandTop} width={g.x1 - g.x0}
        height={Math.max(0, g.bandBot - g.bandTop)} rx="5"></rect>
      <line className="ph-band-edge" x1={g.x0} y1={g.bandTop} x2={g.x1} y2={g.bandTop}></line>
      <line className="ph-band-edge" x1={g.x0} y1={g.bandBot} x2={g.x1} y2={g.bandBot}></line>
      <text className="ph-bandlabel" x={g.x1 - 6} y={(g.bandTop + g.bandBot) / 2}
        textAnchor="end" dominantBaseline="middle">типова ціна · {PHC.range(series)}</text>

      {/* area + line */}
      <path d={g.area} fill={`url(#${g.uid})`}></path>
      <path d={g.line} fill="none" style={{ stroke: curColor }}
        strokeWidth={mobile ? 2.25 : 2.5} strokeLinecap="round" strokeLinejoin="round"></path>

      {/* v1.2.1 — highest price is NOT annotated in UI (no special dot, callout, or label). */}

      {/* guide + current point (the answer: where we are now) */}
      <line x1={g.current.x} y1={g.current.y + 6} x2={g.current.x} y2={g.y1}
        style={{ stroke: curColor }} strokeWidth="1" strokeDasharray="2 4" opacity="0.5"></line>
      <circle cx={g.current.x} cy={g.current.y} r={mobile ? 5 : 6}
        style={{ fill: curColor, stroke: 'var(--surface)' }} strokeWidth="3"></circle>
      <text className={'ph-annot ' + (good ? 'ph-annot--now-good' : 'ph-annot--now')}
        x={g.current.x + 11} y={g.current.y - 4} textAnchor="start" style={{ fontWeight: 600 }}>зараз</text>
      <text className={'ph-annot ' + (good ? 'ph-annot--now-good' : 'ph-annot--now')}
        x={g.current.x + 11} y={g.current.y + 11} textAnchor="start" style={{ fontWeight: 600 }}>{series.current} ₴</text>

      {/* x-axis labels (sparse, calm) */}
      {g.pts.map((p, i) => p.label
        ? <text key={i} className="ph-axislabel" x={Math.min(p.x, g.x1)} y={g.y1 + 16} textAnchor="middle">{p.label}</text>
        : null)}
    </svg>
  );
}

/* ── Period selector (DS chips, no new control language) ─────────────────── */
function PeriodSelector({ value, onChange, mobile }) {
  return (
    <div className={mobile ? 'ph-periods ph-periods--mob' : 'ph-periods'} role="tablist" aria-label="Період">
      {PHC.PERIOD_ORDER.map((k) => (
        <button key={k} type="button" className="ph-period" data-on={value === k}
          role="tab" aria-selected={value === k} onClick={() => onChange(k)}>
          {PHC.SERIES[k].label}
        </button>
      ))}
    </div>
  );
}

/* ── Advisory line (Knyhovyk voice — historical context, never urgency) ──── */
function Advisory({ seriesKey, series: seriesProp, mobile }) {
  const a = seriesProp ? PHC.advisoryFor(seriesProp) : PHC.advisory(seriesKey);
  return (
    <p className={'ph-advisory ph-advisory--' + a.tone + (mobile ? ' ph-advisory--mob' : '')}>
      {a.parts.map((part, i) => typeof part === 'string'
        ? <React.Fragment key={i}>{part}</React.Fragment>
        : <b key={i}>{part.b}</b>)}
    </p>
  );
}

/* ── Stat strip: current / lowest / highest / change ─────────────────────── */
function PriceStats({ seriesKey, series: seriesProp, mobile }) {
  const s = seriesProp || PHC.SERIES[seriesKey];
  const good = s.current <= s.usualLow;
  const down = s.change < 0, up = s.change > 0;
  const chCls = down ? 'ph-stat__change--down' : up ? 'ph-stat__change--up' : 'ph-stat__change--flat';
  return (
    <div className={'ph-stats' + (mobile ? ' ph-stats--mob' : '')}>
      <div className="ph-stat">
        <span className="ph-stat__label">Зараз</span>
        <span className={'ph-stat__val ' + (good ? 'ph-stat__val--now-good' : 'ph-stat__val--now')}>{PHC.uah(s.current)}</span>
      </div>
      <div className="ph-stat">
        <span className="ph-stat__label">Найнижча</span>
        <span className="ph-stat__val ph-stat__val--low">{PHC.uah(s.low)}</span>
      </div>
      <div className="ph-stat">
        <span className="ph-stat__label">Типова ціна</span>
        <span className="ph-stat__val ph-stat__val--typical">{PHC.range(s)}</span>
      </div>
      <div className="ph-stat">
        <span className="ph-stat__label">Зміна</span>
        <span className={'ph-stat__val ph-stat__change ' + chCls}>
          <PHC.Icon name={down ? 'trending-down' : up ? 'trending-up' : 'minus'} size={mobile ? 18 : 20} />
          {(down ? '−' : up ? '+' : '') + Math.abs(s.change) + '%'}
        </span>
      </div>
    </div>
  );
}

/* ── Desktop price-history section ───────────────────────────────────────── */
function PriceHistory({ initial }) {
  const [period, setPeriod] = React.useState(initial || '90');
  return (
    <section className="ph-section" data-screen-label="Price history · desktop">
      <div className="ph-head">
        <h2 className="ph-h2">Динаміка ціни</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      <Advisory seriesKey={period} />
      <div className="ph-card">
        <div className="ph-chartwrap"><PriceChart seriesKey={period} /></div>
        <PriceStats seriesKey={period} />
      </div>
    </section>
  );
}

/* ── Mobile price-history section ────────────────────────────────────────── */
function PriceHistoryMobile({ initial }) {
  const [period, setPeriod] = React.useState(initial || '90');
  return (
    <section className="ph-section ph-section--mob" data-screen-label="Price history · mobile">
      <h2 className="ph-h2 ph-h2--sm">Динаміка ціни</h2>
      <PeriodSelector value={period} onChange={setPeriod} mobile />
      <Advisory seriesKey={period} mobile />
      <div className="ph-card ph-card--mob">
        <div className="ph-chartwrap"><PriceChart seriesKey={period} mobile /></div>
        <PriceStats seriesKey={period} mobile />
      </div>
    </section>
  );
}

/* ── Empty state — "no historical data yet" (honest, calm) ───────────────── */
function PriceHistoryEmpty({ mobile }) {
  const { Badge } = PHC_DS;
  return (
    <section className="ph-section" data-screen-label="Price history · empty">
      <h2 className={'ph-h2' + (mobile ? ' ph-h2--sm' : '')} style={{ marginBottom: 'var(--space-3)' }}>Динаміка ціни</h2>
      <div className={'ph-empty' + (mobile ? ' ph-empty--mob' : '')}>
        <div className="ph-empty__icon"><PHC.Icon name="chart-line" size={20} /></div>
        <div>
          <div className="ph-empty__titlerow">
            <span className="ph-empty__title">Ще збираємо історію</span>
            <Badge tone="neutral">Збираємо дані</Badge>
          </div>
          <p>Knyhovo перевіряє ціни щодня о 08:00. Книговик підкаже, коли настане вдалий момент купувати.</p>
        </div>
      </div>
    </section>
  );
}

/* ── Loading skeleton (warm surfaces, frozen rule) ───────────────────────── */
function PriceHistoryLoading({ mobile }) {
  const chips = 4, stats = 4;
  return (
    <section className={'ph-section' + (mobile ? ' ph-section--mob' : '')} aria-busy="true" data-screen-label="Price history · loading">
      {/* head: section title + period chips (same row as the real component) */}
      <div className="ph-head">
        <span className="ph-sk-block" style={{ width: mobile ? 130 : 168, height: mobile ? 22 : 28 }}></span>
        <div className={mobile ? 'ph-periods ph-periods--mob' : 'ph-periods'}>
          {Array.from({ length: chips }).map((_, i) =>
            <span key={i} className="ph-sk-block" style={{ width: [72, 72, 56, 80][i], height: mobile ? 44 : 32, borderRadius: 999 }}></span>)}
        </div>
      </div>
      {/* explanatory text (two lines, like the advisory) */}
      <div className="ph-sk-lines">
        <span className="ph-sk-block" style={{ width: '92%', maxWidth: 520, height: 13 }}></span>
        <span className="ph-sk-block" style={{ width: '54%', maxWidth: 320, height: 13 }}></span>
      </div>
      {/* card: chart (with typical band hint) + stat row */}
      <div className={'ph-card' + (mobile ? ' ph-card--mob' : '')}>
        <div className={'ph-sk-chart' + (mobile ? ' ph-sk-chart--mob' : '')}>
          <span className="ph-sk-chart__band"></span>
          <span className="ph-sk-chart__axis">
            {[0, 1, 2, 3].map((i) => <span key={i}></span>)}
          </span>
        </div>
        <div className={'ph-stats' + (mobile ? ' ph-stats--mob' : '')}>
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="ph-stat">
              <span className="ph-sk-block" style={{ width: [44, 84, 96, 56][i], height: 11 }}></span>
              <span className="ph-sk-block" style={{ width: [62, 62, 108, 72][i], height: 24, marginTop: 6 }}></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.PHChart = {
  PriceChart, PeriodSelector, Advisory, PriceStats,
  PriceHistory, PriceHistoryMobile, PriceHistoryEmpty, PriceHistoryLoading,
};
