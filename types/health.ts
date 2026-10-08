import { z } from "zod";

// Domain types shared by OCR, AI, database and UI layers. Validation lives here so the same
// rules run when a draft is created by OCR and when the user confirms a corrected version.

export const DOCUMENT_TYPES = ["PRESCRIPTION", "LAB_REPORT", "DOCTOR_VISIT", "OTHER"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const RECORD_STATUSES = ["REVIEW", "SAVED"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RELATIONSHIPS = ["SELF", "CHILD", "PARENT", "ELDER", "OTHER"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const METRIC_NAMES = [
  "hemoglobin",
  "blood_glucose",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "heart_rate",
  "weight",
  "vitamin_d",
  "cholesterol_total",
] as const;
export type MetricName = (typeof METRIC_NAMES)[number];

export const SLOTS = ["MORNING", "AFTERNOON", "NIGHT"] as const;
export type DoseSlot = (typeof SLOTS)[number];

export const FLAGS = ["NORMAL", "LOW", "HIGH", "UNKNOWN"] as const;
export type ValueFlag = (typeof FLAGS)[number];

export const extractedMedicineSchema = z.object({
  name: z.string().trim().min(1, "Medicine name is required").max(120),
  dosage: z.string().trim().max(60).default(""),
  frequency: z.string().trim().max(60).default(""),
  timesPerDay: z.number().int().min(0).max(3).default(1),
  durationDays: z.number().int().min(1).max(730).nullable().default(null),
  notes: z.string().trim().max(300).default(""),
});
export type ExtractedMedicine = z.infer<typeof extractedMedicineSchema>;

export const extractedLabValueSchema = z.object({
  testName: z.string().trim().min(1, "Test name is required").max(120),
  value: z.string().trim().min(1, "Value is required").max(60),
  unit: z.string().trim().max(30).default(""),
  referenceRange: z.string().trim().max(60).default(""),
});
export type ExtractedLabValue = z.infer<typeof extractedLabValueSchema>;

export const extractedRecordSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().min(1, "Title is required").max(120),
  recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  doctorName: z.string().trim().max(120).default(""),
  facility: z.string().trim().max(120).default(""),
  diagnosisTerms: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  medications: z.array(extractedMedicineSchema).max(50).default([]),
  labValues: z.array(extractedLabValueSchema).max(200).default([]),
  warnings: z.array(z.string().max(200)).max(20).default([]),
});
export type ExtractedRecord = z.infer<typeof extractedRecordSchema>;

/** Output of the OCR layer: raw text plus per-page confidence. */
export interface OcrOutput {
  provider: string;
  text: string;
  averageConfidence: number;
  pageCount: number;
}

/** Summary shown on record pages. Text is already localised when generated. */
export interface HealthSummary {
  locale: "en" | "hi";
  recordCountLine: string;
  normalLine: string;
  normalItems: string[];
  attentionItems: string[];
  attentionLabel: "gentle" | "standard" | "none";
  terms: { term: string; explanation: string }[];
  discussItems: string[];
  caution: string;
  generatedAt: string;
}

export interface AssistantSource {
  recordId: string;
  label: string;
}

export interface AssistantAnswer {
  answer: string;
  found: boolean;
  sources: AssistantSource[];
}
