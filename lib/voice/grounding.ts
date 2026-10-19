import type { HealthContext, ContextRecord } from "@/lib/ai/types";
import { translate, type Locale } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/en";
import type { VoiceCitation, VoiceLimitation } from "./types";

// Grounding checks that do not trust the AI provider.
//
// 1. Every number in an answer must exist in this profile's own data (values, ranges, doses, dates,
//    or a small count). A number that appears nowhere in the records means the answer is invented.
//    Limit: a small integer that happens to exist elsewhere in the data cannot be told apart from a
//    real value by this check. Production providers should add claim-level verification.
// 2. Citations are rebuilt from stored rows, so the displayed value, unit and date always match the record.

const NUMBER = /\d+(?:[.,]\d+)?/g;
const SMALL_COUNT_LIMIT = 20;

function parseNumber(token: string): number {
  return Number(token.replace(",", "."));
}

function numbersIn(text: string | null | undefined): number[] {
  if (!text) return [];
  return (text.match(NUMBER) ?? []).map(parseNumber).filter((value) => Number.isFinite(value));
}

/** Every number the answer may legitimately contain for this profile. */
export function allowedNumbers(context: HealthContext): Set<number> {
  const allowed = new Set<number>();
  for (let count = 0; count <= SMALL_COUNT_LIMIT; count += 1) allowed.add(count);
  const add = (values: number[]) => values.forEach((value) => allowed.add(value));

  for (const record of context.records) {
    add(numbersIn(record.date));
    add(numbersIn(record.title));
    for (const lab of record.labs) {
      add(numbersIn(lab.value));
      add(numbersIn(lab.referenceRange));
      if (lab.numericValue !== null) add([lab.numericValue]);
    }
    for (const medicine of record.medications) {
      add(numbersIn(medicine.dosage));
      add([medicine.timesPerDay]);
      if (medicine.durationDays !== null) add([medicine.durationDays]);
    }
  }
  for (const medicine of context.medications) {
    add(numbersIn(medicine.dosage));
    add([medicine.timesPerDay]);
    if (medicine.durationDays !== null) add([medicine.durationDays]);
    add(numbersIn(medicine.startDate));
  }
  for (const points of Object.values(context.metrics)) {
    for (const point of points ?? []) {
      add([point.value]);
      add(numbersIn(point.date));
      if (point.referenceLow !== null) add([point.referenceLow]);
      if (point.referenceHigh !== null) add([point.referenceHigh]);
    }
  }
  add(numbersIn(context.today));
  return allowed;
}

export interface NumericCheck {
  ok: boolean;
  unsupported: string[];
}

/** Returns the numbers in the answer that the profile's data does not contain. */
export function checkNumericGrounding(answer: string, context: HealthContext): NumericCheck {
  const allowed = allowedNumbers(context);
  const tokens = answer.match(NUMBER) ?? [];
  const unsupported = tokens.filter((token) => !allowed.has(parseNumber(token)));
  return { ok: unsupported.length === 0, unsupported };
}

/** The label a lab row is usually called in an answer, in the answer's language. */
function metricLabelFor(metricName: string | null, locale: Locale): string | null {
  if (!metricName) return null;
  const base = metricName.replace(/_(systolic|diastolic)$/, "");
  const key = `metric.${base}` as MessageKey;
  return translate(locale, key);
}

function labMentioned(testName: string, metricName: string | null, answerLower: string, locale: Locale): boolean {
  if (testName && answerLower.includes(testName.toLowerCase())) return true;
  const label = metricLabelFor(metricName, locale);
  return Boolean(label && answerLower.includes(label.toLowerCase()));
}

export function citationsFor(args: {
  answer: string;
  locale: Locale;
  context: HealthContext;
  recordIds: string[];
}): VoiceCitation[] {
  const answerLower = args.answer.toLowerCase();
  const wanted = new Set(args.recordIds);
  const citations: VoiceCitation[] = [];
  const seen = new Set<string>();

  for (const record of args.context.records) {
    if (!wanted.has(record.id)) continue;
    const matchedLabs = record.labs.filter((lab) => labMentioned(lab.testName, lab.metricName, answerLower, args.locale));
    if (matchedLabs.length === 0) {
      const key = `${record.id}:-`;
      if (!seen.has(key)) {
        seen.add(key);
        citations.push(recordCitation(record));
      }
      continue;
    }
    for (const lab of matchedLabs) {
      const key = `${record.id}:${lab.testName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push({
        recordId: record.id,
        reportTitle: record.title,
        reportDate: record.date.slice(0, 10),
        testName: lab.testName,
        value: lab.value,
        unit: lab.unit,
        referenceRange: lab.referenceRange,
        flag: lab.flag,
      });
    }
  }
  return citations.slice(0, 12);
}

function recordCitation(record: ContextRecord): VoiceCitation {
  return {
    recordId: record.id,
    reportTitle: record.title,
    reportDate: record.date.slice(0, 10),
    testName: null,
    value: null,
    unit: null,
    referenceRange: null,
    flag: null,
  };
}

/** Limitation keys that describe the evidence behind the cited values. */
export function evidenceLimitations(args: { citations: VoiceCitation[]; context: HealthContext }): VoiceLimitation[] {
  const limitations = new Set<VoiceLimitation>();
  for (const citation of args.citations) {
    if (citation.testName !== null) {
      if (citation.referenceRange === null || citation.flag === "UNKNOWN") limitations.add("voice.limit.noRange");
      if (citation.unit === null) limitations.add("voice.limit.unit");
    }
    const record = args.context.records.find((item) => item.id === citation.recordId);
    if (record && record.warnings.length > 0) limitations.add("voice.limit.lowConfidence");
  }
  return [...limitations];
}
