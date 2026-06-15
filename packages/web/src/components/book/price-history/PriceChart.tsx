'use client';

import { useId } from 'react';
import type { PriceHistoryViewModel } from '@/lib/priceHistory';
import { formatRange } from '@/lib/priceHistory';

export interface PriceChartProps {
  readonly vm: PriceHistoryViewModel;
}

interface GeomPad {
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

interface Geom {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  line: string;
  area: string;
  pts: Array<{ x: number; y: number; p: number; label: string }>;
  bandTop: number;
  bandBot: number;
  current: { x: number; y: number; p: number; label: string };
}

function phGeom(
  vm: PriceHistoryViewModel,
  W: number,
  H: number,
  pad: GeomPad,
): Geom {
  const { padL, padR, padT, padB } = pad;
  const x0 = padL,
    x1 = W - padR,
    y0 = padT,
    y1 = H - padB;

  const prices = vm.points
    .map((d) => d.p)
    .concat([vm.usualLow, vm.usualHigh]);
  const dMin = Math.min(...prices),
    dMax = Math.max(...prices);
  const span = Math.max(1, dMax - dMin);
  const m = span * 0.12; // soft headroom
  const lo = dMin - m,
    hi = dMax + m;

  const xCoord = (i: number) =>
    x0 +
    (x1 - x0) *
      (vm.points.length === 1 ? 0.5 : i / (vm.points.length - 1));
  const yCoord = (p: number) => y1 - (y1 - y0) * ((p - lo) / (hi - lo));

  const pts = vm.points.map((d, i) => ({
    x: xCoord(i),
    y: yCoord(d.p),
    p: d.p,
    label: d.x,
  }));

  // Gentle smoothing — horizontal-tangent cubic through midpoints (organic, calm)
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      mx = (a.x + b.x) / 2;
    line += ` C ${mx.toFixed(1)} ${a.y.toFixed(1)} ${mx.toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const area =
    line +
    ` L ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x0.toFixed(1)} ${y1.toFixed(1)} Z`;

  return {
    x0,
    x1,
    y0,
    y1,
    line,
    area,
    pts,
    bandTop: yCoord(vm.usualHigh),
    bandBot: yCoord(vm.usualLow),
    current: pts[pts.length - 1],
  };
}

function ChartSvg({
  vm,
  W,
  H,
  pad,
  gradientId,
  className,
  dotR,
  strokeW,
}: {
  vm: PriceHistoryViewModel;
  W: number;
  H: number;
  pad: GeomPad;
  gradientId: string;
  className: string;
  dotR: number;
  strokeW: number;
}): React.JSX.Element {
  const g = phGeom(vm, W, H, pad);
  const good = vm.current <= vm.usualLow;
  const curColor = good ? 'var(--brand-green)' : 'var(--accent)';

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Динаміка ціни за ${vm.label}. Зараз ${vm.current} ₴, найнижча ${vm.low} ₴. Типовий діапазон ${vm.usualLow}–${vm.usualHigh} ₴.`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: curColor }} stopOpacity="0.16" />
          <stop offset="1" style={{ stopColor: curColor }} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Typical price range band */}
      <rect
        className="ph-band"
        x={g.x0}
        y={g.bandTop}
        width={g.x1 - g.x0}
        height={Math.max(0, g.bandBot - g.bandTop)}
        rx="5"
      />
      <line
        className="ph-band-edge"
        x1={g.x0}
        y1={g.bandTop}
        x2={g.x1}
        y2={g.bandTop}
      />
      <line
        className="ph-band-edge"
        x1={g.x0}
        y1={g.bandBot}
        x2={g.x1}
        y2={g.bandBot}
      />
      <text
        className="ph-bandlabel"
        x={g.x1 - 6}
        y={(g.bandTop + g.bandBot) / 2}
        textAnchor="end"
        dominantBaseline="middle"
      >
        типова ціна · {formatRange(vm.usualLow * 100, vm.usualHigh * 100)}
      </text>

      {/* Area + line */}
      <path d={g.area} fill={`url(#${gradientId})`} />
      <path
        d={g.line}
        fill="none"
        style={{ stroke: curColor }}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* v1.2.1: highest price is NOT annotated (no dot/callout/label) */}

      {/* Guide + current point (the answer: where we are now) */}
      <line
        x1={g.current.x}
        y1={g.current.y + 6}
        x2={g.current.x}
        y2={g.y1}
        style={{ stroke: curColor }}
        strokeWidth="1"
        strokeDasharray="2 4"
        opacity="0.5"
      />
      <circle
        cx={g.current.x}
        cy={g.current.y}
        r={dotR}
        style={{ fill: curColor, stroke: 'var(--surface)' }}
        strokeWidth="3"
      />
      <text
        className={
          'ph-annot ' + (good ? 'ph-annot--now-good' : 'ph-annot--now')
        }
        x={g.current.x + 11}
        y={g.current.y - 4}
        textAnchor="start"
        style={{ fontWeight: 600 }}
      >
        зараз
      </text>
      <text
        className={
          'ph-annot ' + (good ? 'ph-annot--now-good' : 'ph-annot--now')
        }
        x={g.current.x + 11}
        y={g.current.y + 11}
        textAnchor="start"
        style={{ fontWeight: 600 }}
      >
        {vm.current} ₴
      </text>

      {/* X-axis labels (sparse, calm) */}
      {g.pts.map((p, i) =>
        p.label ? (
          <text
            key={i}
            className="ph-axislabel"
            x={Math.min(p.x, g.x1)}
            y={g.y1 + 16}
            textAnchor="middle"
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/**
 * PriceChart — renders two SVGs (desktop 760×244, mobile 340×168), toggled
 * by CSS media query via class names. Uses React.useId() for a stable, SSR-safe
 * gradient id (no Math.random).
 */
export function PriceChart({ vm }: PriceChartProps): React.JSX.Element {
  const uid = useId();
  const gradientDId = `ph-g-d-${uid}`;
  const gradientMId = `ph-g-m-${uid}`;

  return (
    <div className="ph-chartwrap">
      {/* Desktop chart — hidden on mobile via CSS */}
      <ChartSvg
        vm={vm}
        W={760}
        H={244}
        pad={{ padL: 14, padR: 92, padT: 26, padB: 30 }}
        gradientId={gradientDId}
        className="ph-chart ph-chart--d"
        dotR={6}
        strokeW={2.5}
      />
      {/* Mobile chart — hidden on desktop via CSS */}
      <ChartSvg
        vm={vm}
        W={340}
        H={168}
        pad={{ padL: 10, padR: 60, padT: 24, padB: 28 }}
        gradientId={gradientMId}
        className="ph-chart ph-chart--m"
        dotR={5}
        strokeW={2.25}
      />
    </div>
  );
}
