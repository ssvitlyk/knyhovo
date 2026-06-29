import type { Labels, MetricsSnapshot, MetricSnapshot } from './types.js';

/** Content-Type for the Prometheus text exposition format (v0.0.4). */
export const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/** Escape a label value per the Prometheus text format (`\`, `"`, newline). */
function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Render a label set as `{a="1",b="2"}`, sorted for stable output, or '' when empty. */
function renderLabels(labels: Labels, extra?: Readonly<Record<string, string>>): string {
  const merged: Record<string, string> = { ...labels, ...extra };
  const names = Object.keys(merged).sort();
  if (names.length === 0) return '';
  const parts = names.map((name) => `${name}="${escapeLabelValue(merged[name]!)}"`);
  return `{${parts.join(',')}}`;
}

/** `+Inf` for the terminal histogram bucket; plain number otherwise. */
function renderLe(le: number): string {
  return le === Number.POSITIVE_INFINITY ? '+Inf' : String(le);
}

/**
 * Render a sample value per the Prometheus spec, which represents non-finite
 * floats as `+Inf` / `-Inf` / `NaN` (JS `String()` would emit `Infinity` /
 * `-Infinity`). Finite numbers are unchanged.
 */
function formatValue(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Number.POSITIVE_INFINITY) return '+Inf';
  if (value === Number.NEGATIVE_INFINITY) return '-Inf';
  return String(value);
}

function renderMetric(metric: MetricSnapshot): string[] {
  const lines: string[] = [`# HELP ${metric.name} ${metric.help}`, `# TYPE ${metric.name} ${metric.type}`];

  if (metric.type === 'counter' || metric.type === 'gauge') {
    for (const sample of metric.samples) {
      lines.push(`${metric.name}${renderLabels(sample.labels)} ${formatValue(sample.value)}`);
    }
    return lines;
  }

  // histogram
  for (const sample of metric.samples) {
    for (const bucket of sample.buckets) {
      lines.push(
        `${metric.name}_bucket${renderLabels(sample.labels, { le: renderLe(bucket.le) })} ${formatValue(bucket.count)}`,
      );
    }
    lines.push(`${metric.name}_sum${renderLabels(sample.labels)} ${formatValue(sample.sum)}`);
    lines.push(`${metric.name}_count${renderLabels(sample.labels)} ${formatValue(sample.count)}`);
  }
  return lines;
}

/**
 * Renders a {@link MetricsSnapshot} into the Prometheus text exposition format.
 * Stateless: it reads a snapshot and returns text, so it can be reused across
 * requests and tested without a registry.
 */
export class PrometheusExporter {
  export(snapshot: MetricsSnapshot): string {
    const blocks = snapshot.metrics.map((metric) => renderMetric(metric).join('\n'));
    // Trailing newline is part of the exposition format.
    return blocks.length === 0 ? '' : `${blocks.join('\n')}\n`;
  }
}
