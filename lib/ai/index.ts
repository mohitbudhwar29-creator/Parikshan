import { getHealthAIProvider } from "./provider";
import type { HealthAIProvider, HealthContext } from "./types";
import type { Locale } from "@/lib/i18n";

export type { HealthAIProvider, HealthContext } from "./types";

/** Turns OCR text into a structured, validated extraction. */
export function extractMedicalData(input: Parameters<HealthAIProvider["extractMedicalData"]>[0]) {
  return getHealthAIProvider().extractMedicalData(input);
}

/** Plain-language summary of one record, grounded in that record's stored values. */
export function generateSummary(input: { context: HealthContext; recordId: string; locale: Locale }) {
  return getHealthAIProvider().generateSummary(input);
}

/** Answers a question using only the uploaded records in the context. */
export function answerQuestion(input: { context: HealthContext; question: string; locale: Locale }) {
  return getHealthAIProvider().answerQuestion(input);
}

/** Explains a medical term in plain language. Never diagnoses. */
export function explainMedicalTerm(input: { term: string; locale: Locale }) {
  return getHealthAIProvider().explainMedicalTerm(input);
}
