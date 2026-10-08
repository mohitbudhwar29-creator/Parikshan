import type { ChatAnswer, HealthSummarySections, Language, ResultStatus } from "@/types/domain";

/**
 * AI abstraction.
 *
 * The UI never imports a vendor SDK. It asks for `getHealthAIProvider()` and
 * calls one of the four operations below. `MockHealthAIProvider` (default, works
 * offline) and the hosted providers share this contract, so switching to
 * OpenAI/Gemini/Azure is an environment-variable change.
 *
 * SAFETY CONTRACT (enforced for every provider):
 *  1. Answers may only reference data present in `AIContext`.
 *  2. If the answer is not in the records, return the "not found" answer with
 *     `grounded: false` instead of inventing history.
 *  3. Never diagnose, never recommend starting/stopping/changing medication.
 *  4. Every answer carries source references and a "discuss with your doctor" line.
 */

export type AIContextLabValue = {
  testName: string;
  metricKey: string | null;
  value: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
  status: ResultStatus;
};

export type AIContextMedicine = {
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  status: string;
};

export type AIContextRecord = {
  id: string;
  type: string;
  title: string;
  date: Date;
  doctorName: string | null;
  facilityName: string | null;
  diagnosisTerms: string[];
  labValues: AIContextLabValue[];
  medicines: AIContextMedicine[];
  summary: string | null;
};

export type AIContextMetric = {
  metricKey: string;
  label: string;
  value: number;
  unit: string;
  recordedAt: Date;
  referenceRange: string | null;
  sourceRecordId: string | null;
  sourceRecordTitle: string | null;
};

export type AIContext = {
  profileName: string;
  /** Child profiles get softer wording and a caregiver prompt. */
  isChild: boolean;
  isElder: boolean;
  language: Language;
  records: AIContextRecord[];
  medications: AIContextMedicine[];
  metrics: AIContextMetric[];
  today: Date;
};

export type SummaryRequest = {
  context: AIContext;
  record: AIContextRecord;
};

export type SummaryResponse = {
  summary: HealthSummarySections;
  provider: string;
  isMock: boolean;
  /** Set when a hosted provider failed and we fell back to the mock. */
  fallbackReason?: string;
};

export type QuestionRequest = {
  context: AIContext;
  question: string;
  language: Language;
};

export type QuestionResponse = ChatAnswer & {
  provider: string;
  isMock: boolean;
  fallbackReason?: string;
};

export interface HealthAIProvider {
  readonly name: string;
  readonly isMock: boolean;
  generateSummary(request: SummaryRequest): Promise<SummaryResponse>;
  answerQuestion(request: QuestionRequest): Promise<QuestionResponse>;
  explainMedicalTerm(term: string, language: Language): Promise<string>;
}
