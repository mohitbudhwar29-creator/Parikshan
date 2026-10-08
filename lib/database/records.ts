import type { HealthRecord, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "./prisma";
import {
  computeFlag,
  findMetricByTestName,
  formatReferenceRange,
  METRIC_DEFINITIONS,
  parseBloodPressure,
  parseBloodPressureRange,
  parseNumericValue,
  parseReferenceRange,
  worstFlag,
} from "@/lib/health/metrics";
import { endDateForDuration } from "@/lib/health/medication-schedule";
import type { ExtractedRecord, MetricName, ValueFlag } from "@/types/health";

export interface RecordFileInfo {
  fileKey: string;
  fileName: string;
  mimeType: string;
}

export interface SaveRecordInput {
  profileId: string;
  extracted: ExtractedRecord;
  file?: RecordFileInfo | null;
  rawText?: string | null;
  ocrProvider?: string | null;
}

/** Calendar dates are stored as UTC midnight. */
export function toRecordDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

interface LabRow {
  testName: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
  flag: ValueFlag;
  metricName: string | null;
  date: Date;
}

interface MetricRow {
  metricName: MetricName;
  value: number;
  unit: string;
  recordedAt: Date;
  referenceLow: number | null;
  referenceHigh: number | null;
}

/**
 * Turns confirmed extraction rows into lab-result rows and trackable metric rows.
 * Blood pressure "120/80" becomes two metrics (systolic and diastolic) so it can be charted.
 */
export function buildLabAndMetricRows(
  extracted: ExtractedRecord,
  recordDate: Date,
): { labs: LabRow[]; metrics: MetricRow[] } {
  const labs: LabRow[] = [];
  const metrics: MetricRow[] = [];

  for (const row of extracted.labValues) {
    const metricName = findMetricByTestName(row.testName);
    const bloodPressure = parseBloodPressure(row.value);
    const isBloodPressure = bloodPressure !== null && metricName === "blood_pressure_systolic";

    if (isBloodPressure && bloodPressure) {
      const ranges = parseBloodPressureRange(row.referenceRange);
      const systolicFlag = computeFlag(bloodPressure.systolic, ranges.systolic);
      const diastolicFlag = computeFlag(bloodPressure.diastolic, ranges.diastolic);
      labs.push({
        testName: row.testName,
        value: row.value,
        numericValue: bloodPressure.systolic,
        unit: row.unit || "mmHg",
        referenceRange: row.referenceRange || null,
        flag: worstFlag(systolicFlag, diastolicFlag),
        metricName: "blood_pressure_systolic",
        date: recordDate,
      });
      metrics.push(
        {
          metricName: "blood_pressure_systolic",
          value: bloodPressure.systolic,
          unit: "mmHg",
          recordedAt: recordDate,
          referenceLow: ranges.systolic?.low ?? null,
          referenceHigh: ranges.systolic?.high ?? null,
        },
        {
          metricName: "blood_pressure_diastolic",
          value: bloodPressure.diastolic,
          unit: "mmHg",
          recordedAt: recordDate,
          referenceLow: ranges.diastolic?.low ?? null,
          referenceHigh: ranges.diastolic?.high ?? null,
        },
      );
      continue;
    }

    const numeric = parseNumericValue(row.value);
    const range = parseReferenceRange(row.referenceRange);
    const flag: ValueFlag = numeric === null ? "UNKNOWN" : computeFlag(numeric, range);
    const unit = row.unit || (metricName ? METRIC_DEFINITIONS[metricName].unit : null);

    labs.push({
      testName: row.testName,
      value: row.value,
      numericValue: numeric,
      unit,
      referenceRange: row.referenceRange || null,
      flag,
      metricName,
      date: recordDate,
    });

    if (metricName && numeric !== null) {
      metrics.push({
        metricName,
        value: numeric,
        unit: unit ?? METRIC_DEFINITIONS[metricName].unit,
        recordedAt: recordDate,
        referenceLow: range?.low ?? null,
        referenceHigh: range?.high ?? null,
      });
    }
  }

  return { labs, metrics };
}

function recordScalarFields(extracted: ExtractedRecord, rawText?: string | null, ocrProvider?: string | null) {
  return {
    type: extracted.documentType,
    title: extracted.title,
    recordDate: toRecordDate(extracted.recordDate),
    doctorName: extracted.doctorName || null,
    facility: extracted.facility || null,
    extractedJson: JSON.stringify(extracted),
    rawText: rawText ?? null,
    ocrProvider: ocrProvider ?? null,
  };
}

/** Stores an OCR draft (status REVIEW). Drafts are invisible to the timeline until confirmed. */
export async function createDraftRecord(input: SaveRecordInput): Promise<string> {
  const record = await prisma.healthRecord.create({
    data: {
      profileId: input.profileId,
      status: "REVIEW",
      fileKey: input.file?.fileKey ?? null,
      fileName: input.file?.fileName ?? null,
      mimeType: input.file?.mimeType ?? null,
      ...recordScalarFields(input.extracted, input.rawText, input.ocrProvider),
    },
  });
  return record.id;
}

/**
 * Confirms a record: validates through the caller, then writes the record, lab results, metrics
 * and medicines in one transaction. Re-confirming an existing record replaces its derived rows.
 */
export async function saveConfirmedRecord(input: SaveRecordInput & { recordId?: string | null }): Promise<string> {
  const recordDate = toRecordDate(input.extracted.recordDate);
  const scalars = recordScalarFields(input.extracted, input.rawText, input.ocrProvider);
  const fileFields = input.file
    ? { fileKey: input.file.fileKey, fileName: input.file.fileName, mimeType: input.file.mimeType }
    : {};

  return prisma.$transaction(async (tx) => {
    let recordId: string;
    if (input.recordId) {
      const updated = await tx.healthRecord.updateMany({
        where: { id: input.recordId, profileId: input.profileId },
        data: { ...scalars, ...fileFields, status: "SAVED", summary: null },
      });
      if (updated.count !== 1) throw new Error("RECORD_NOT_FOUND");
      recordId = input.recordId;
      await tx.labResult.deleteMany({ where: { healthRecordId: recordId } });
      await tx.healthMetric.deleteMany({ where: { sourceRecordId: recordId } });
      await tx.medication.deleteMany({ where: { sourceRecordId: recordId } });
    } else {
      const created = await tx.healthRecord.create({
        data: { profileId: input.profileId, status: "SAVED", ...scalars, ...fileFields },
      });
      recordId = created.id;
    }

    const { labs, metrics } = buildLabAndMetricRows(input.extracted, recordDate);
    if (labs.length > 0) {
      await tx.labResult.createMany({ data: labs.map((lab) => ({ ...lab, healthRecordId: recordId })) });
    }
    if (metrics.length > 0) {
      await tx.healthMetric.createMany({
        data: metrics.map((metric) => ({ ...metric, profileId: input.profileId, sourceRecordId: recordId })),
      });
    }
    if (input.extracted.medications.length > 0) {
      await tx.medication.createMany({
        data: input.extracted.medications.map((medicine) => ({
          profileId: input.profileId,
          sourceRecordId: recordId,
          name: medicine.name,
          dosage: medicine.dosage || "As written",
          frequency: medicine.frequency || "",
          timesPerDay: medicine.timesPerDay,
          durationDays: medicine.durationDays,
          startDate: recordDate,
          endDate: endDateForDuration(recordDate, medicine.durationDays),
          notes: medicine.notes || null,
        })),
      });
    }
    return recordId;
  });
}

const recordListInclude = {
  _count: { select: { labResults: true, medications: true } },
} satisfies Prisma.HealthRecordInclude;

export type RecordListItem = Prisma.HealthRecordGetPayload<{ include: typeof recordListInclude }>;

/** Confirmed records for a profile, newest first. */
export async function listSavedRecords(profileId: string, take?: number): Promise<RecordListItem[]> {
  return prisma.healthRecord.findMany({
    where: { profileId, status: "SAVED" },
    include: recordListInclude,
    orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
    take,
  });
}

/** Drafts waiting for the user to review them. */
export async function listDraftRecords(profileId: string): Promise<HealthRecord[]> {
  return prisma.healthRecord.findMany({
    where: { profileId, status: "REVIEW" },
    orderBy: { createdAt: "desc" },
  });
}

/** Full record detail, scoped to a profile so records cannot be read across profiles. */
export async function getRecordForProfile(profileId: string, recordId: string) {
  return prisma.healthRecord.findFirst({
    where: { id: recordId, profileId },
    include: {
      labResults: { orderBy: { testName: "asc" } },
      medications: { orderBy: { name: "asc" } },
    },
  });
}

/** Ownership check through the profile relation: the record must belong to one of the user's profiles. */
export async function getRecordForUser(userId: string, recordId: string) {
  return prisma.healthRecord.findFirst({
    where: { id: recordId, profile: { userId } },
    include: {
      labResults: { orderBy: { testName: "asc" } },
      medications: { orderBy: { name: "asc" } },
    },
  });
}

/** Deletes a record with its derived medicines and metrics. Returns the stored file key to clean up. */
export async function deleteRecordForProfile(profileId: string, recordId: string): Promise<string | null | "NOT_FOUND"> {
  return prisma.$transaction(async (tx) => {
    const record = await tx.healthRecord.findFirst({ where: { id: recordId, profileId }, select: { fileKey: true } });
    if (!record) return "NOT_FOUND";
    await tx.healthMetric.deleteMany({ where: { sourceRecordId: recordId } });
    await tx.medication.deleteMany({ where: { sourceRecordId: recordId } });
    await tx.healthRecord.delete({ where: { id: recordId } });
    return record.fileKey;
  });
}

/** Persists a generated AI summary (cached with its locale). */
export async function saveRecordSummary(recordId: string, profileId: string, summaryJson: string): Promise<void> {
  await prisma.healthRecord.updateMany({ where: { id: recordId, profileId }, data: { summary: summaryJson } });
}
