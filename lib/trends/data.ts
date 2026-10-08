import type { MetricPoint } from "@/lib/database/metrics";
import { summarizeTrend, formatMetricValue, type TrendSummary } from "@/lib/health/trends";
import type { MetricName } from "@/types/health";

// Turns stored metric series into chart-ready data. Pure: safe to share with client components.

export interface TrendChartPoint {
  label: string;
  date: string;
  value: number;
  diastolic: number | null;
  low: number | null;
  high: number | null;
}

export interface TrendReading {
  date: string;
  value: string;
  diastolic: string | null;
  source: string;
}

export interface TrendPanelData {
  key: string;
  label: string;
  referenceText: string;
  summary: TrendSummary | null;
  diastolicSummary: TrendSummary | null;
  chart: TrendChartPoint[];
  readings: TrendReading[];
  isBloodPressure: boolean;
  displayUnit: string;
  metric: MetricName;
}

export function sameDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Builds the panel for one metric. Blood pressure combines the systolic and diastolic series by day. */
export function buildTrendPanel(args: {
  key: string;
  label: string;
  primary: MetricName;
  secondary?: MetricName;
  series: Record<MetricName, MetricPoint[]>;
  formatDateLabel: (iso: string) => string;
  sourceLabel: (type: string | null) => string;
}): TrendPanelData {
  const { key, label, primary, secondary, series, formatDateLabel, sourceLabel } = args;
  const summary = summarizeTrend(primary, series[primary]);
  const diastolicSummary = secondary ? summarizeTrend(secondary, series[secondary]) : null;

  const diastolicByDay = new Map<string, number>();
  for (const point of secondary ? series[secondary] : []) diastolicByDay.set(sameDay(point.date), point.value);

  // One point per day, newest value wins (the series is already sorted oldest to newest).
  const byDay = new Map<string, MetricPoint>();
  for (const point of series[primary]) byDay.set(sameDay(point.date), point);
  const days = [...byDay.values()];

  const chart: TrendChartPoint[] = days.map((point) => ({
    label: formatDateLabel(point.date),
    date: point.date,
    value: point.value,
    diastolic: secondary ? (diastolicByDay.get(sameDay(point.date)) ?? null) : null,
    low: point.referenceLow,
    high: point.referenceHigh,
  }));

  const readings: TrendReading[] = [...days].reverse().map((point) => {
    const diastolic = diastolicByDay.get(sameDay(point.date));
    return {
      date: formatDateLabel(point.date),
      value: formatMetricValue(primary, point.value),
      diastolic: secondary && diastolic !== undefined ? formatMetricValue("blood_pressure_diastolic", diastolic) : null,
      source: sourceLabel(point.sourceType),
    };
  });

  const latest = summary?.latest;
  const referenceText =
    latest && (latest.referenceLow !== null || latest.referenceHigh !== null)
      ? latest.referenceLow !== null && latest.referenceHigh !== null
        ? `${latest.referenceLow}–${latest.referenceHigh}`
        : latest.referenceHigh !== null
          ? `< ${latest.referenceHigh}`
          : `> ${latest.referenceLow}`
      : "";

  return {
    key,
    label,
    referenceText,
    summary,
    diastolicSummary,
    chart,
    readings,
    isBloodPressure: Boolean(secondary),
    displayUnit: latest?.unit ?? "",
    metric: primary,
  };
}
