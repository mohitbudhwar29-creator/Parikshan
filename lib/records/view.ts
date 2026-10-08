import type { ExtractedRecord, HealthSummary, ValueFlag, DocumentType, RecordStatus } from "@/types/health";
import { computeFlag, parseBloodPressure, parseBloodPressureRange, parseNumericValue, parseReferenceRange, worstFlag } from "@/lib/health/metrics";

// Plain data shapes shared by server pages and client components. Pure: no database or server-only imports.

export interface LabView {
  id: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: ValueFlag;
}

export interface MedicineView {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timesPerDay: number;
  durationDays: number | null;
  startDate: string;
  endDate: string | null;
  notes: string;
}

export interface RecordView {
  id: string;
  status: RecordStatus;
  type: DocumentType;
  title: string;
  recordDate: string;
  fileName: string | null;
  hasFile: boolean;
  doctorName: string;
  facility: string;
  diagnosisTerms: string[];
  labs: LabView[];
  medicines: MedicineView[];
  warnings: string[];
  summary: HealthSummary | null;
  /** The editable structure, rebuilt from stored values so a saved record can be corrected too. */
  extracted: ExtractedRecord;
  createdAt: string;
}

/** Flag for a displayed value, computed from the printed range. Blood pressure uses both numbers. */
export function flagForLabValue(value: string, referenceRange: string): ValueFlag {
  const bloodPressure = parseBloodPressure(value);
  if (bloodPressure) {
    const ranges = parseBloodPressureRange(referenceRange);
    return worstFlag(computeFlag(bloodPressure.systolic, ranges.systolic), computeFlag(bloodPressure.diastolic, ranges.diastolic));
  }
  const numeric = parseNumericValue(value);
  if (numeric === null) return "UNKNOWN";
  return computeFlag(numeric, parseReferenceRange(referenceRange));
}

interface StoredRecord {
  id: string;
  status: string;
  type: string;
  title: string;
  recordDate: Date;
  doctorName: string | null;
  facility: string | null;
  fileKey: string | null;
  fileName: string | null;
  summary: string | null;
  extractedJson: string | null;
  createdAt: Date;
  labResults: { id: string; testName: string; value: string; unit: string | null; referenceRange: string | null }[];
  medications: {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    timesPerDay: number;
    durationDays: number | null;
    startDate: Date;
    endDate: Date | null;
    notes: string | null;
  }[];
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Converts a database record (with its labs and medicines) into the view model. */
export function toRecordView(record: StoredRecord): RecordView {
  const stored = parseJson<Partial<ExtractedRecord>>(record.extractedJson) ?? {};
  const diagnosisTerms = Array.isArray(stored.diagnosisTerms) ? stored.diagnosisTerms : [];
  const warnings = Array.isArray(stored.warnings) ? stored.warnings : [];
  const recordDate = record.recordDate.toISOString().slice(0, 10);
  const labs: LabView[] = record.labResults.map((lab) => ({
    id: lab.id,
    testName: lab.testName,
    value: lab.value,
    unit: lab.unit ?? "",
    referenceRange: lab.referenceRange ?? "",
    flag: flagForLabValue(lab.value, lab.referenceRange ?? ""),
  }));
  const medicines: MedicineView[] = record.medications.map((medicine) => ({
    id: medicine.id,
    name: medicine.name,
    dosage: medicine.dosage,
    frequency: medicine.frequency,
    timesPerDay: medicine.timesPerDay,
    durationDays: medicine.durationDays,
    startDate: medicine.startDate.toISOString().slice(0, 10),
    endDate: medicine.endDate ? medicine.endDate.toISOString().slice(0, 10) : null,
    notes: medicine.notes ?? "",
  }));
  const summary = parseJson<HealthSummary>(record.summary);
  return {
    id: record.id,
    status: record.status as RecordStatus,
    type: record.type as DocumentType,
    title: record.title,
    recordDate,
    fileName: record.fileName,
    hasFile: Boolean(record.fileKey),
    doctorName: record.doctorName ?? "",
    facility: record.facility ?? "",
    diagnosisTerms,
    labs,
    medicines,
    warnings,
    summary,
    createdAt: record.createdAt.toISOString(),
    extracted: {
      documentType: record.type as DocumentType,
      title: record.title,
      recordDate,
      doctorName: record.doctorName ?? "",
      facility: record.facility ?? "",
      diagnosisTerms,
      medications: medicines.map((medicine) => ({
        name: medicine.name,
        dosage: medicine.dosage,
        frequency: medicine.frequency,
        timesPerDay: Math.min(Math.max(medicine.timesPerDay, 0), 3),
        durationDays: medicine.durationDays,
        notes: medicine.notes,
      })),
      labValues: labs.map((lab) => ({
        testName: lab.testName,
        value: lab.value,
        unit: lab.unit,
        referenceRange: lab.referenceRange,
      })),
      warnings,
    },
  };
}
