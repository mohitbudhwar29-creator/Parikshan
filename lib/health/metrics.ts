import type { MessageKey } from "@/lib/i18n/en";
import { METRIC_NAMES, type MetricName, type ValueFlag } from "@/types/health";

export interface ReferenceRange {
  low: number | null;
  high: number | null;
}

interface MetricDefinition {
  name: MetricName;
  unit: string;
  labelKey: MessageKey;
  easyLabelKey: MessageKey;
  glossaryKey: MessageKey;
  /** Matches the test name as printed on a document. Anchored so "LDL Cholesterol" is not "Total". */
  testNamePattern: RegExp;
}

/**
 * Catalogue of trackable values. Only values present in a printed reference range are ever flagged;
 * the app never invents a "normal" range, so trends are never labelled dangerous without a source.
 */
export const METRIC_DEFINITIONS: Record<MetricName, MetricDefinition> = {
  hemoglobin: {
    name: "hemoglobin",
    unit: "g/dL",
    labelKey: "metric.hemoglobin",
    easyLabelKey: "metric.hemoglobin.easy",
    glossaryKey: "gloss.hemoglobin",
    testNamePattern: /^(h(a)?emoglobin|hb|hgb)\b/i,
  },
  blood_glucose: {
    name: "blood_glucose",
    unit: "mg/dL",
    labelKey: "metric.blood_glucose",
    easyLabelKey: "metric.blood_glucose.easy",
    glossaryKey: "gloss.glucose",
    testNamePattern: /^((blood )?(glucose|sugar)|fbs|rbs|fasting (blood )?(glucose|sugar))/i,
  },
  blood_pressure_systolic: {
    name: "blood_pressure_systolic",
    unit: "mmHg",
    labelKey: "metric.blood_pressure_systolic",
    easyLabelKey: "metric.blood_pressure_systolic",
    glossaryKey: "gloss.bloodPressure",
    testNamePattern: /^(blood pressure|bp)\b/i,
  },
  blood_pressure_diastolic: {
    name: "blood_pressure_diastolic",
    unit: "mmHg",
    labelKey: "metric.blood_pressure_diastolic",
    easyLabelKey: "metric.blood_pressure_diastolic",
    glossaryKey: "gloss.bloodPressure",
    // Diastolic is derived from the blood pressure line, not matched by name.
    testNamePattern: /(?!)/,
  },
  heart_rate: {
    name: "heart_rate",
    unit: "bpm",
    labelKey: "metric.heart_rate",
    easyLabelKey: "metric.heart_rate.easy",
    glossaryKey: "gloss.heartRate",
    testNamePattern: /^(heart rate|pulse)/i,
  },
  weight: {
    name: "weight",
    unit: "kg",
    labelKey: "metric.weight",
    easyLabelKey: "metric.weight.easy",
    glossaryKey: "gloss.weight",
    testNamePattern: /^(body )?weight\b/i,
  },
  vitamin_d: {
    name: "vitamin_d",
    unit: "ng/mL",
    labelKey: "metric.vitamin_d",
    easyLabelKey: "metric.vitamin_d.easy",
    glossaryKey: "gloss.vitaminD",
    testNamePattern: /^(vitamin ?d|25[- ]?(oh|hydroxy))/i,
  },
  cholesterol_total: {
    name: "cholesterol_total",
    unit: "mg/dL",
    labelKey: "metric.cholesterol_total",
    easyLabelKey: "metric.cholesterol_total.easy",
    glossaryKey: "gloss.cholesterol",
    testNamePattern: /^(total )?cholesterol\b/i,
  },
};

export function getMetricDefinition(name: MetricName): MetricDefinition {
  return METRIC_DEFINITIONS[name];
}

/** Finds the tracked metric for a test name as printed on a document, or null if untracked. */
export function findMetricByTestName(testName: string): MetricName | null {
  const cleaned = testName.trim();
  for (const name of METRIC_NAMES) {
    if (name === "blood_pressure_diastolic") continue;
    if (METRIC_DEFINITIONS[name].testNamePattern.test(cleaned)) return name;
  }
  return null;
}

/** Parses a printed numeric value such as "11.0", "7,800" or "120". Returns null for text values. */
export function parseNumericValue(raw: string): number | null {
  const match = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number.parseFloat(match[0]);
  return Number.isFinite(value) ? value : null;
}

/** Parses "120/80" into systolic and diastolic values. */
export function parseBloodPressure(raw: string): { systolic: number; diastolic: number } | null {
  const match = raw.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return null;
  const systolic = Number.parseFloat(match[1] ?? "");
  const diastolic = Number.parseFloat(match[2] ?? "");
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
  return { systolic, diastolic };
}

/**
 * Parses a printed reference range: "12.0 - 16.0", "< 200", "> 40", "70 to 100".
 * Returns null when the text does not contain a recognisable range.
 */
export function parseReferenceRange(raw: string | null | undefined): ReferenceRange | null {
  if (!raw) return null;
  const text = raw.replace(/,/g, "").trim();
  const bounded = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i);
  if (bounded) {
    return { low: Number.parseFloat(bounded[1] ?? ""), high: Number.parseFloat(bounded[2] ?? "") };
  }
  const upperOnly = text.match(/^(?:<|≤|below|under)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (upperOnly) return { low: null, high: Number.parseFloat(upperOnly[1] ?? "") };
  const lowerOnly = text.match(/^(?:>|≥|above|over)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (lowerOnly) return { low: Number.parseFloat(lowerOnly[1] ?? ""), high: null };
  return null;
}

/** Splits a blood pressure reference such as "90-120 / 60-80" into systolic and diastolic ranges. */
export function parseBloodPressureRange(raw: string | null | undefined): {
  systolic: ReferenceRange | null;
  diastolic: ReferenceRange | null;
} {
  if (!raw) return { systolic: null, diastolic: null };
  const [systolicPart = "", diastolicPart = ""] = raw.split("/");
  return {
    systolic: parseReferenceRange(systolicPart),
    diastolic: parseReferenceRange(diastolicPart),
  };
}

/** Compares a value with a printed range. Returns UNKNOWN when no range was printed. */
export function computeFlag(value: number, range: ReferenceRange | null): ValueFlag {
  if (!range || (range.low === null && range.high === null)) return "UNKNOWN";
  if (range.low !== null && value < range.low) return "LOW";
  if (range.high !== null && value > range.high) return "HIGH";
  return "NORMAL";
}

/** Formats a range for display, e.g. "12–16" or "< 200". */
export function formatReferenceRange(range: ReferenceRange | null, raw?: string | null): string {
  if (raw && raw.trim()) return raw.trim();
  if (!range) return "";
  if (range.low !== null && range.high !== null) return `${range.low}–${range.high}`;
  if (range.high !== null) return `< ${range.high}`;
  if (range.low !== null) return `> ${range.low}`;
  return "";
}

/** Combines two flags, preferring the one that needs attention. */
export function worstFlag(a: ValueFlag, b: ValueFlag): ValueFlag {
  if (a === "HIGH" || b === "HIGH") return "HIGH";
  if (a === "LOW" || b === "LOW") return "LOW";
  if (a === "NORMAL" || b === "NORMAL") return "NORMAL";
  return "UNKNOWN";
}
