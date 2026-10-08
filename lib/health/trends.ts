import { computeFlag, getMetricDefinition } from "./metrics";
import type { MetricName, ValueFlag } from "@/types/health";

export interface TrendPoint {
  date: string;
  value: number;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
  recordId?: string | null;
}

export interface TrendSummary {
  metric: MetricName;
  latest: TrendPoint;
  previous: TrendPoint | null;
  first: TrendPoint | null;
  /** latest minus previous reading, rounded to one decimal place. */
  changeFromPrevious: number | null;
  /** latest minus first reading, rounded to one decimal place. */
  changeSinceFirst: number | null;
  flag: ValueFlag;
  readingCount: number;
}

const dayKey = (iso: string) => iso.slice(0, 10);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the "compared with previous" and "since first report" comparison from a series sorted oldest to newest.
 * Readings taken on the same day count as one point, so two values from the same report are never compared.
 */
export function summarizeTrend(metric: MetricName, points: TrendPoint[]): TrendSummary | null {
  const byDay = new Map<string, TrendPoint>();
  for (const point of points) byDay.set(dayKey(point.date), point);
  const series = [...byDay.values()];
  const latest = series[series.length - 1];
  if (!latest) return null;
  const previous = series.length > 1 ? (series[series.length - 2] ?? null) : null;
  const first = series[0] ?? null;
  const range =
    latest.referenceLow !== null || latest.referenceHigh !== null
      ? { low: latest.referenceLow, high: latest.referenceHigh }
      : null;
  return {
    metric,
    latest,
    previous,
    first: first && first !== latest ? first : null,
    changeFromPrevious: previous ? round1(latest.value - previous.value) : null,
    changeSinceFirst: first && first !== latest ? round1(latest.value - first.value) : null,
    flag: computeFlag(latest.value, range),
    readingCount: series.length,
  };
}

export function trendLabelKey(metric: MetricName): `metric.${MetricName}` {
  return `metric.${metric}`;
}

export function trendDefinition(metric: MetricName) {
  return getMetricDefinition(metric);
}

export function formatChange(change: number | null): string {
  if (change === null) return "—";
  if (change === 0) return "0";
  return change > 0 ? `+${change}` : `${change}`;
}

const DECIMALS: Partial<Record<MetricName, number>> = { hemoglobin: 1, vitamin_d: 1, weight: 1 };

/** Shows a value the way a printed report would: hemoglobin "11.0", glucose "108", BP is shown elsewhere. */
export function formatMetricValue(metric: MetricName, value: number): string {
  const decimals = DECIMALS[metric] ?? 0;
  return value.toFixed(decimals);
}

export function formatChangeFor(metric: MetricName, change: number | null): string {
  if (change === null) return "—";
  const text = formatMetricValue(metric, Math.abs(change));
  if (Number(text) === 0) return "0";
  return change > 0 ? `+${text}` : `−${text}`;
}
