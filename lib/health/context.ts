import { prisma } from "@/lib/database/prisma";
import { getMetricSeries } from "@/lib/database/metrics";
import { medicationStatus } from "./medication-schedule";
import type { HealthContext } from "@/lib/ai/types";
import { METRIC_NAMES, type Relationship } from "@/types/health";
import { startOfUtcDay } from "@/lib/utils";

/**
 * Builds the only data the AI may see for one profile: its saved records, medicines and metric
 * history. Everything is loaded through the profile id, which the caller has already ownership-checked.
 */
export async function buildHealthContext(profile: { id: string; name: string; relationship: string }): Promise<HealthContext> {
  const [records, medications, series] = await Promise.all([
    prisma.healthRecord.findMany({
      where: { profileId: profile.id, status: "SAVED" },
      include: {
        labResults: { orderBy: { testName: "asc" } },
        medications: { orderBy: { name: "asc" } },
      },
      orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.medication.findMany({
      where: { profileId: profile.id },
      include: { sourceRecord: { select: { type: true } } },
    }),
    getMetricSeries(profile.id),
  ]);

  const today = new Date();
  const todayUtc = startOfUtcDay(today);

  const metrics: HealthContext["metrics"] = {};
  for (const name of METRIC_NAMES) {
    metrics[name] = series[name].map((point) => ({
      recordId: point.recordId,
      date: point.sourceDate ?? point.date,
      value: point.value,
      unit: point.unit,
      referenceLow: point.referenceLow,
      referenceHigh: point.referenceHigh,
    }));
  }

  return {
    profile: { name: profile.name, relationship: profile.relationship as Relationship },
    today: todayUtc.toISOString().slice(0, 10),
    metrics,
    records: records.map((record) => ({
      id: record.id,
      type: record.type,
      title: record.title,
      date: record.recordDate.toISOString(),
      doctorName: record.doctorName,
      facility: record.facility,
      diagnosisTerms: parseDiagnosisTerms(record.extractedJson),
      labs: record.labResults.map((lab) => ({
        testName: lab.testName,
        value: lab.value,
        numericValue: lab.numericValue,
        unit: lab.unit,
        referenceRange: lab.referenceRange,
        flag: lab.flag as "NORMAL" | "LOW" | "HIGH" | "UNKNOWN",
        metricName: lab.metricName,
      })),
      medications: record.medications.map((medicine) => ({
        name: medicine.name,
        dosage: medicine.dosage,
        timesPerDay: medicine.timesPerDay,
        durationDays: medicine.durationDays,
      })),
    })),
    medications: medications.map((medicine) => ({
      name: medicine.name,
      dosage: medicine.dosage,
      timesPerDay: medicine.timesPerDay,
      durationDays: medicine.durationDays,
      startDate: medicine.startDate.toISOString(),
      endDate: medicine.endDate?.toISOString() ?? null,
      status: medicationStatus({ startDate: medicine.startDate, endDate: medicine.endDate }, todayUtc),
      sourceRecordId: medicine.sourceRecordId,
      sourceType: medicine.sourceRecord?.type ?? null,
    })),
  };
}

function parseDiagnosisTerms(extractedJson: string | null): string[] {
  if (!extractedJson) return [];
  try {
    const parsed = JSON.parse(extractedJson) as { diagnosisTerms?: unknown };
    return Array.isArray(parsed.diagnosisTerms) ? parsed.diagnosisTerms.filter((term): term is string => typeof term === "string") : [];
  } catch {
    return [];
  }
}
