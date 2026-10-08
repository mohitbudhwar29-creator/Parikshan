import { prisma } from "./prisma";
import { METRIC_NAMES, type MetricName } from "@/types/health";

export interface MetricPoint {
  recordId: string | null;
  sourceType: string | null;
  sourceDate: string | null;
  date: string;
  value: number;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
}

export type MetricSeries = Record<MetricName, MetricPoint[]>;

/** All tracked values for a profile, grouped by metric and sorted oldest to newest. */
export async function getMetricSeries(profileId: string): Promise<MetricSeries> {
  const rows = await prisma.healthMetric.findMany({
    where: { profileId },
    include: { sourceRecord: { select: { id: true, type: true, recordDate: true } } },
    orderBy: { recordedAt: "asc" },
  });

  const series = Object.fromEntries(METRIC_NAMES.map((name) => [name, [] as MetricPoint[]])) as MetricSeries;
  for (const row of rows) {
    const name = row.metricName as MetricName;
    if (!series[name]) continue;
    series[name].push({
      recordId: row.sourceRecordId,
      sourceType: row.sourceRecord?.type ?? null,
      sourceDate: row.sourceRecord?.recordDate.toISOString() ?? null,
      date: row.recordedAt.toISOString(),
      value: row.value,
      unit: row.unit,
      referenceLow: row.referenceLow,
      referenceHigh: row.referenceHigh,
    });
  }
  return series;
}
