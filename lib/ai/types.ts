import type {
  AssistantAnswer,
  ExtractedRecord,
  HealthSummary,
  MetricName,
  Relationship,
  ValueFlag,
} from "@/types/health";
import type { Locale } from "@/lib/i18n";

// Provider-neutral AI contract. The UI and server actions only depend on these types, so a hosted
// model (OpenAI, Gemini, Azure OpenAI, a local model...) can replace the mock without UI changes.

export interface ContextRecord {
  id: string;
  type: string;
  title: string;
  date: string;
  doctorName: string | null;
  facility: string | null;
  diagnosisTerms: string[];
  labs: { testName: string; value: string; numericValue: number | null; unit: string | null; referenceRange: string | null; flag: ValueFlag; metricName: string | null }[];
  medications: { name: string; dosage: string; timesPerDay: number; durationDays: number | null }[];
}

export interface ContextMedication {
  name: string;
  dosage: string;
  timesPerDay: number;
  durationDays: number | null;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "UPCOMING" | "COMPLETED";
  sourceRecordId: string | null;
  sourceType: string | null;
}

export interface ContextMetricPoint {
  recordId: string | null;
  date: string;
  value: number;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
}

/** Everything the AI is allowed to know about one profile. Nothing else is sent to a model. */
export interface HealthContext {
  profile: { name: string; relationship: Relationship };
  records: ContextRecord[];
  medications: ContextMedication[];
  metrics: Partial<Record<MetricName, ContextMetricPoint[]>>;
  today: string;
}

export interface HealthAIProvider {
  readonly name: string;
  extractMedicalData(input: { text: string; ocrConfidence: number; fallbackDate: string }): Promise<ExtractedRecord>;
  generateSummary(input: { context: HealthContext; recordId: string; locale: Locale }): Promise<HealthSummary>;
  answerQuestion(input: { context: HealthContext; question: string; locale: Locale }): Promise<AssistantAnswer>;
  explainMedicalTerm(input: { term: string; locale: Locale }): Promise<{ found: boolean; explanation: string }>;
}
