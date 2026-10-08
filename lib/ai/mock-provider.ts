import {
  classifyDocument,
  DEFAULT_TITLES,
  extractLabValues,
  extractPrescriptionData,
  findDiagnosisTerms,
  findDoctorName,
  findDocumentDate,
  findFacilityName,
} from "@/lib/ocr/parsers";
import { computeFlag, formatReferenceRange, worstFlag, type ReferenceRange } from "@/lib/health/metrics";
import { formatMetricValue } from "@/lib/health/trends";
import { frequencyLabelKey } from "@/lib/health/medication-schedule";
import { createTranslator, type Locale, type Translator } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/en";
import {
  extractedRecordSchema,
  type AssistantAnswer,
  type AssistantSource,
  type DocumentType,
  type ExtractedLabValue,
  type ExtractedRecord,
  type HealthSummary,
  type MetricName,
} from "@/types/health";
import { findGlossaryEntry } from "./glossary";
import type { ContextMetricPoint, ContextRecord, HealthAIProvider, HealthContext } from "./types";

const RECORD_TYPE_KEYS: Record<string, MessageKey> = {
  PRESCRIPTION: "record.type.PRESCRIPTION",
  LAB_REPORT: "record.type.LAB_REPORT",
  DOCTOR_VISIT: "record.type.DOCTOR_VISIT",
  OTHER: "record.type.OTHER",
};

const METRIC_LABEL_KEYS: Record<string, MessageKey> = {
  hemoglobin: "metric.hemoglobin",
  blood_glucose: "metric.blood_glucose",
  blood_pressure: "metric.blood_pressure",
  heart_rate: "metric.heart_rate",
  weight: "metric.weight",
  vitamin_d: "metric.vitamin_d",
  cholesterol_total: "metric.cholesterol_total",
};

// Safety guard: diagnosis questions and medicine-decision questions each get a fixed, non-advisory reply.
const DIAGNOSIS_PATTERN = /do i have|am i (sick|ill)|diagnos|cancer|is it dangerous|कैंसर|डायग्नो/i;
const UNSAFE_PATTERN =
  /should i stop|stop taking|should i (take|start)|how (much|many) .*should i take|increase (my )?dose|double (the )?dose|बंद कर|रोक दूं|रोक दूँ|रोकूं|खुराक (बढ़|घटा|बदल)/i;

// Keyword routes, English and Hindi. Order in answerQuestion matters.
const METRIC_PATTERNS: { metric: MetricName | "blood_pressure"; pattern: RegExp }[] = [
  { metric: "hemoglobin", pattern: /hemoglobin|haemoglobin|\bhb\b|हीमोग्लोबिन|हिमोग्लोबिन/i },
  { metric: "blood_glucose", pattern: /glucose|sugar|शुगर|शर्करा|चीनी|ग्लूकोज/i },
  { metric: "blood_pressure", pattern: /blood pressure|\bbp\b|रक्तचाप|बीपी|ब्लड प्रेशर|ब्लड प्रेसर/i },
  { metric: "heart_rate", pattern: /heart rate|pulse|हृदय|नाड़ी|धड़कन/i },
  { metric: "weight", pattern: /\bweight\b|वजन/i },
  { metric: "vitamin_d", pattern: /vitamin ?d|विटामिन ?d|विटामिन डी/i },
  { metric: "cholesterol_total", pattern: /cholesterol|कोलेस्ट्रॉल|कोलेस्ट्रोल/i },
];
const PRESCRIPTION_WORDS = /prescription|पर्चा|पर्चे|प्रिस्क्रिप्शन/i;
const MEDICINE_WORDS = /medicine|medication|drug|दवा|दवाई|दवाइ/i;
const CURRENT_WORDS = /current|currently|now|taking|active|abhi|अभी|इस समय|चल रह|ले रह/i;
const LAST_WORDS = /last|latest|when|recent|कब|आखिर|आख़िर|हाल|नवीनतम|अंतिम/i;
const CHANGE_WORDS = /change|changed|latest|what.*new|बदल|नवीनतम|नई|सबसे नई/i;
const EXPLAIN_WORDS = /explain|simple|meaning|mean|summar|समझ|मतलब|अर्थ|सरल|बताएं|बताएँ|बताइए|बताइये/i;

interface MetricReading {
  date: string;
  recordId: string | null;
  display: string;
  unit: string;
  flag: ReturnType<typeof computeFlag>;
  rangeText: string;
  rangeFlagSource: ReferenceRange | null;
}

/**
 * Demo AI. It answers only from the records it is given and never invents history.
 * It recognises intents with keyword rules (English and Hindi) and writes replies from the
 * translation dictionary. Replace it with a hosted model via HealthAIProvider (see README).
 */
export class MockHealthAIProvider implements HealthAIProvider {
  readonly name = "mock-grounded-ai";

  async extractMedicalData(input: { text: string; ocrConfidence: number; fallbackDate: string }): Promise<ExtractedRecord> {
    const documentType: DocumentType = classifyDocument(input.text);
    const { medications, warnings: medicineWarnings } = extractPrescriptionData(input.text);
    const labValues: ExtractedLabValue[] = extractLabValues(input.text);
    const detectedDate = findDocumentDate(input.text);

    const warnings = [...medicineWarnings];
    if (!detectedDate) warnings.push("We couldn't read the date. Today's date was used. Please correct it.");
    if (input.ocrConfidence < 0.85) warnings.push("Some text was hard to read. Please check each value against the original.");
    if (documentType === "PRESCRIPTION" && medications.length === 0) warnings.push("No medicines were read from this document.");
    if (documentType === "LAB_REPORT" && labValues.length < 3) warnings.push("Only a few values were read. Please compare with the original.");

    // Validation is the last gate before anything is stored or shown as extracted.
    return extractedRecordSchema.parse({
      documentType,
      title: DEFAULT_TITLES[documentType],
      recordDate: detectedDate ?? input.fallbackDate,
      doctorName: findDoctorName(input.text),
      facility: findFacilityName(input.text),
      diagnosisTerms: findDiagnosisTerms(input.text),
      medications: medications.slice(0, 50),
      labValues: labValues.slice(0, 200),
      warnings: warnings.slice(0, 20),
    });
  }

  async generateSummary(input: { context: HealthContext; recordId: string; locale: Locale }): Promise<HealthSummary> {
    const t = createTranslator(input.locale);
    const record = input.context.records.find((item) => item.id === input.recordId);
    if (!record) throw new Error("RECORD_NOT_FOUND");

    const isChild = input.context.profile.relationship === "CHILD";
    const typeLabel = t(RECORD_TYPE_KEYS[record.type] ?? "record.type.OTHER");
    const ranged = record.labs.filter((lab) => lab.flag !== "UNKNOWN");
    const normal = record.labs.filter((lab) => lab.flag === "NORMAL");
    const outside = record.labs.filter((lab) => lab.flag === "LOW" || lab.flag === "HIGH");

    let recordCountLine: string;
    if (record.labs.length > 0) {
      recordCountLine = t("summary.recordCount", { type: typeLabel, count: record.labs.length });
    } else if (record.medications.length > 0) {
      recordCountLine = t("summary.prescriptionCount", { count: record.medications.length });
    } else {
      recordCountLine = t("summary.noValues");
    }

    const attentionItems = outside.map((lab) => {
      const value = lab.unit ? `${lab.value} ${lab.unit}` : lab.value;
      if (isChild) return `${t("summary.attentionGentle", { name: lab.testName })}`;
      const line = t("summary.attentionLine", {
        name: lab.testName,
        value,
        range: formatReferenceRange(null, lab.referenceRange),
      });
      const previous = previousReading(input.context, lab.metricName, record.date, record.id);
      if (!previous || lab.numericValue === null) return line;
      const isLower = previous.numeric > lab.numericValue;
      const change = t(isLower ? "summary.attentionChange" : "summary.attentionHigherChange", {
        previous: `${previous.display}${lab.unit ? ` ${lab.unit}` : ""}`,
        date: formatShort(previous.date, input.locale),
      });
      return `${line} ${change}`;
    });

    const discussItems = [
      ...outside.map((lab) => t("summary.discussChange", { name: lab.testName })),
      record.medications.length > 0 ? t("summary.discussMedicines") : null,
      t("summary.discussGeneric"),
    ].filter((item): item is string => Boolean(item));

    return {
      locale: input.locale,
      recordCountLine,
      normalLine: ranged.length === 0 ? t("summary.noNormal") : t("summary.normalLine", { count: normal.length, total: ranged.length }),
      normalItems: normal.map((lab) => (lab.unit ? `${lab.testName}: ${lab.value} ${lab.unit}` : `${lab.testName}: ${lab.value}`)).slice(0, 20),
      attentionItems: attentionItems.slice(0, 20),
      attentionLabel: outside.length === 0 ? "none" : isChild ? "gentle" : "standard",
      terms: summaryTerms(record.labs, t, record.medications.length > 0),
      discussItems: [...new Set(discussItems)].slice(0, 10),
      caution: t("summary.caution"),
      generatedAt: new Date().toISOString(),
    };
  }

  async answerQuestion(input: { context: HealthContext; question: string; locale: Locale }): Promise<AssistantAnswer> {
    const t = createTranslator(input.locale);
    const question = input.question.trim();
    const { context, locale } = input;

    if (context.records.length === 0) return { answer: t("assistant.noRecords"), found: false, sources: [] };
    if (DIAGNOSIS_PATTERN.test(question)) return { answer: t("ai.noDiagnosis"), found: false, sources: [] };
    if (UNSAFE_PATTERN.test(question)) return { answer: t("ai.unsafe"), found: false, sources: [] };

    const metric = METRIC_PATTERNS.find((entry) => entry.pattern.test(question));
    if (metric) return answerMetric(metric.metric, context, t, locale);
    if (PRESCRIPTION_WORDS.test(question) && LAST_WORDS.test(question)) return answerLastPrescription(context, t, locale);
    if (MEDICINE_WORDS.test(question)) return answerMedicines(context, CURRENT_WORDS.test(question), t, locale);
    if (CHANGE_WORDS.test(question)) return answerChanges(context, t, locale);
    if (EXPLAIN_WORDS.test(question)) return answerExplainLatest(context, t, locale);

    return { answer: `${t("ai.notFound")} ${t("ai.relatedGeneral")}`, found: false, sources: [] };
  }

  async explainMedicalTerm(input: { term: string; locale: Locale }): Promise<{ found: boolean; explanation: string }> {
    const t = createTranslator(input.locale);
    const entry = findGlossaryEntry(input.term);
    return entry ? { found: true, explanation: t(entry.explanationKey) } : { found: false, explanation: t("ai.termUnknown") };
  }
}

function answerMetric(metric: MetricName | "blood_pressure", context: HealthContext, t: Translator, locale: Locale): AssistantAnswer {
  const readings = metricReadings(context, metric);
  const latest = readings[readings.length - 1];
  if (!latest) return { answer: t("ai.notFound"), found: false, sources: [] };
  const previous = readings.length > 1 ? readings[readings.length - 2] : undefined;
  const label = t(METRIC_LABEL_KEYS[metric] ?? "metric.blood_pressure");

  const lines = [t("ai.metricLatest", { metric: label, value: latest.display, unit: latest.unit, date: formatShort(latest.date, locale) })];
  if (latest.rangeText) lines.push(t("ai.metricRange", { range: latest.rangeText, flag: flagSentence(latest.flag, t) }));
  if (previous) {
    lines.push(
      previous.display === latest.display
        ? t("ai.noChange", { metric: label })
        : t("ai.changeLine", {
            metric: label,
            from: previous.display,
            to: latest.display,
            unit: latest.unit,
            fromDate: formatShort(previous.date, locale),
            toDate: formatShort(latest.date, locale),
          }),
    );
  }
  const first = readings[0];
  if (first && readings.length >= 3 && first.display !== latest.display) {
    lines.push(t("ai.sinceFirst", { metric: label, from: first.display, to: latest.display, unit: latest.unit, fromDate: formatShort(first.date, locale) }));
  }
  if (readings.length >= 3) {
    lines.push(t("ai.metricHistory", { list: readings.map((reading) => `${formatShort(reading.date, locale)}: ${reading.display}`).join(", ") }));
  }
  return { answer: lines.join("\n"), found: true, sources: sourcesFor(context, [latest, previous], locale) };
}

function answerLastPrescription(context: HealthContext, t: Translator, locale: Locale): AssistantAnswer {
  const latest = context.records.find((record) => record.type === "PRESCRIPTION");
  if (!latest) return { answer: t("ai.noPrescription"), found: false, sources: [] };
  return {
    answer: t("ai.lastPrescription", { date: formatShort(latest.date, locale), count: latest.medications.length }),
    found: true,
    sources: sourcesFor(context, [latest], locale),
  };
}

function answerMedicines(context: HealthContext, currentOnly: boolean, t: Translator, locale: Locale): AssistantAnswer {
  if (currentOnly) {
    const active = context.medications.filter((medication) => medication.status === "ACTIVE");
    if (active.length === 0) return { answer: t("ai.noMedicines"), found: false, sources: [] };
    return {
      answer: t("ai.activeMedicines", { list: active.map((medication) => medicineLine(medication, t)).join("; ") }),
      found: true,
      sources: sourcesByIds(context, active.map((medication) => medication.sourceRecordId), locale),
    };
  }
  const prescription = context.records.find((record) => record.type === "PRESCRIPTION" && record.medications.length > 0);
  if (!prescription) return { answer: t("ai.noMedicines"), found: false, sources: [] };
  const list = prescription.medications.map((medicine) => medicineLine(medicine, t)).join("; ");
  return {
    answer: `${t("ai.medicinesPrescribed", { list })} ${t("ai.moreMedicines")}`,
    found: true,
    sources: sourcesFor(context, [prescription], locale),
  };
}

function answerChanges(context: HealthContext, t: Translator, locale: Locale): AssistantAnswer {
  const reports = context.records.filter((record) => record.type === "LAB_REPORT" && record.labs.length > 0);
  const [latest, previous] = reports;
  if (!latest || !previous) {
    return { answer: t("ai.changedNone"), found: reports.length > 0, sources: sourcesFor(context, reports.slice(0, 1), locale) };
  }

  const changes: string[] = [];
  for (const lab of latest.labs) {
    const before = previous.labs.find((item) => item.testName === lab.testName);
    if (!before || before.value === lab.value) continue;
    changes.push(
      t("ai.changeLine", {
        metric: lab.testName,
        from: before.value,
        to: lab.value,
        unit: lab.unit ?? "",
        fromDate: formatShort(previous.date, locale),
        toDate: formatShort(latest.date, locale),
      }),
    );
  }
  const body = changes.length > 0 ? `${t("ai.changedIntro")}\n${changes.join("\n")}` : t("ai.noChangesAll");
  return {
    answer: `${t("ai.changedLatest", { date: formatShort(latest.date, locale) })}\n${body}`,
    found: true,
    sources: sourcesFor(context, [latest, previous], locale),
  };
}

function answerExplainLatest(context: HealthContext, t: Translator, locale: Locale): AssistantAnswer {
  const latest = context.records[0];
  if (!latest) return { answer: t("ai.notFound"), found: false, sources: [] };
  return {
    answer: t("ai.explainLatest", {
      type: t(RECORD_TYPE_KEYS[latest.type] ?? "record.type.OTHER"),
      date: formatShort(latest.date, locale),
      count: latest.labs.length || latest.medications.length,
    }),
    found: true,
    sources: sourcesFor(context, [latest], locale),
  };
}

function formatShort(iso: string, locale: Locale): string {
  return formatDate(new Date(iso), locale, "short");
}

function flagSentence(flag: ReturnType<typeof computeFlag>, t: Translator): string {
  if (flag === "LOW") return t("ai.flagLow");
  if (flag === "HIGH") return t("ai.flagHigh");
  if (flag === "NORMAL") return t("ai.flagNormal");
  return "";
}

function medicineLine(
  medication: { name: string; dosage: string; timesPerDay: number; durationDays: number | null },
  t: Translator,
): string {
  return t("ai.medicinesEach", {
    name: medication.name,
    dosage: medication.dosage,
    frequency: t(frequencyLabelKey(medication.timesPerDay)),
    duration: medication.durationDays ? t("meds.durationDays", { count: medication.durationDays }) : t("meds.ongoing"),
  });
}

function sourcesFor(
  context: HealthContext,
  items: (ContextRecord | MetricReading | undefined)[],
  locale: Locale,
): AssistantSource[] {
  const ids = items.map((item) => {
    if (!item) return null;
    return "id" in item ? item.id : item.recordId;
  });
  return sourcesByIds(context, ids, locale);
}

function sourcesByIds(context: HealthContext, ids: (string | null)[], locale: Locale): AssistantSource[] {
  const seen = new Set<string>();
  const sources: AssistantSource[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    const record = context.records.find((item) => item.id === id);
    if (!record) continue;
    seen.add(id);
    sources.push({ recordId: id, label: sourceLabel(record, locale) });
  }
  return sources;
}

/** "Blood Test — 12 Sep 2026", localised. */
export function sourceLabel(record: ContextRecord, locale: Locale): string {
  const t = createTranslator(locale);
  return `${t(RECORD_TYPE_KEYS[record.type] ?? "record.type.OTHER")} — ${formatShort(record.date, locale)}`;
}

function metricReadings(context: HealthContext, metric: MetricName | "blood_pressure"): MetricReading[] {
  if (metric === "blood_pressure") {
    const systolic = context.metrics.blood_pressure_systolic ?? [];
    const diastolic = context.metrics.blood_pressure_diastolic ?? [];
    return systolic.map((point) => {
      const pair = diastolic.find((item) => item.recordId === point.recordId && item.date === point.date);
      const systolicRange = rangeOf(point);
      const diastolicRange = pair ? rangeOf(pair) : null;
      const flag = worstFlag(
        computeFlag(point.value, systolicRange),
        pair ? computeFlag(pair.value, diastolicRange) : "UNKNOWN",
      );
      return {
        date: point.date,
        recordId: point.recordId,
        display: pair
          ? `${formatMetricValue("blood_pressure_systolic", point.value)}/${formatMetricValue("blood_pressure_diastolic", pair.value)}`
          : formatMetricValue("blood_pressure_systolic", point.value),
        unit: "mmHg",
        flag,
        rangeText: systolicRange ? formatReferenceRange(systolicRange, null) : "",
        rangeFlagSource: systolicRange,
      };
    });
  }
  return (context.metrics[metric] ?? []).map((point) => {
    const range = rangeOf(point);
    return {
      date: point.date,
      recordId: point.recordId,
      display: formatMetricValue(metric, point.value),
      unit: point.unit,
      flag: computeFlag(point.value, range),
      rangeText: range ? formatReferenceRange(range, null) : "",
      rangeFlagSource: range,
    };
  });
}

function rangeOf(point: ContextMetricPoint): ReferenceRange | null {
  if (point.referenceLow === null && point.referenceHigh === null) return null;
  return { low: point.referenceLow, high: point.referenceHigh };
}

/** Finds the reading before the current record for the same test, for "compared with previous" wording. */
function previousReading(context: HealthContext, metricName: string | null, date: string, recordId: string) {
  if (!metricName || metricName === "blood_pressure_diastolic") return null;
  const points = (context.metrics[metricName as MetricName] ?? []).filter(
    (point) => point.recordId !== recordId && point.date < date,
  );
  const last = points[points.length - 1];
  if (!last) return null;
  let display = formatMetricValue(metricName as MetricName, last.value);
  if (metricName === "blood_pressure_systolic") {
    const diastolic = (context.metrics.blood_pressure_diastolic ?? []).find((point) => point.recordId === last.recordId);
    if (diastolic) display = `${formatMetricValue("blood_pressure_systolic", last.value)}/${formatMetricValue("blood_pressure_diastolic", diastolic.value)}`;
  }
  return { numeric: last.value, display, date: last.date };
}

function summaryTerms(labs: ContextRecord["labs"], t: Translator, hasMedicines: boolean) {
  const terms: { term: string; explanation: string }[] = [];
  const seen = new Set<MessageKey>();
  const add = (term: string, explanationKey: MessageKey) => {
    if (seen.has(explanationKey)) return;
    seen.add(explanationKey);
    terms.push({ term, explanation: t(explanationKey) });
  };
  for (const lab of labs) {
    const entry = findGlossaryEntry(lab.testName);
    if (entry) add(lab.testName, entry.explanationKey);
  }
  const lowHemoglobin = labs.some((lab) => lab.metricName === "hemoglobin" && lab.flag === "LOW");
  if (lowHemoglobin) add("Anemia", "gloss.anemia");
  if (labs.some((lab) => lab.referenceRange)) add("Reference range", "gloss.referenceRange");
  if (hasMedicines) add("Medicine interaction", "gloss.interaction");
  return terms.slice(0, 6);
}

