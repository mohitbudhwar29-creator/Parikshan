import type { DocumentType, ExtractedLabValue, ExtractedMedicine } from "@/types/health";

// Deterministic parsers for OCR text. They work on any engine's output that keeps one row per line,
// which is why they are shared by the mock provider and any real OCR provider.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Finds the first recognisable date, preferring a value that follows a "date" label. */
export function findDocumentDate(text: string): string | null {
  const labelled = text.match(/(?:sample date|report date|visit date|date)\s*[:\-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/i);
  const numeric = labelled ?? text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
  if (numeric) {
    // Indian documents use day-first ordering.
    const iso = isoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    if (iso) return iso;
  }
  const worded = text.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})\b/);
  if (worded) {
    const month = MONTHS[(worded[2] ?? "").toLowerCase()];
    if (month) return isoDate(Number(worded[3]), month, Number(worded[1]));
  }
  return null;
}

export function findDoctorName(text: string): string {
  // Spaces only (not newlines): the name must sit on the same line as "Dr.".
  const match = text.match(/\b(Dr\.?[ \t]+[A-Z][A-Za-z]*(?:[ \t]+[A-Z][A-Za-z]*)?)/);
  if (!match?.[1]) return "";
  const cleaned = match[1].replace(/\s+/g, " ").replace(/^Dr\s/, "Dr. ");
  return cleaned.trim();
}

/** The first line of a letterhead is treated as the facility name when it is mostly capitals. */
export function findFacilityName(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
  const withoutNote = firstLine.replace(/\(.*?\)/g, "").trim();
  const letters = withoutNote.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "");
  if (withoutNote.length >= 4 && withoutNote.length <= 60 && letters.length > 0 && upper.length / letters.length > 0.8) {
    return withoutNote;
  }
  return "";
}

export function findDiagnosisTerms(text: string): string[] {
  const match = text.match(/^\s*(?:diagnosis|impression|dx)\s*[:\-]\s*(.+)$/im);
  if (!match?.[1]) return [];
  return match[1]
    .replace(/\(.*?\)/g, "")
    .split(/[,;]/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && term.length <= 120)
    .slice(0, 10);
}

/** Frequency such as "1-0-1", "BD", "TDS", "twice daily" as a number of doses per day (0 = as needed). */
export function parseFrequency(text: string): { timesPerDay: number | null; clamped: boolean } {
  const schedule = text.match(/^\s*(\d)\s*-\s*(\d)\s*-\s*(\d)\s*$/);
  if (schedule) {
    const count = [schedule[1], schedule[2], schedule[3]].filter((digit) => Number(digit) > 0).length;
    return { timesPerDay: clampTimes(count), clamped: count > 3 };
  }
  if (/\b(SOS|as needed|prn)\b/i.test(text)) return { timesPerDay: 0, clamped: false };
  if (/\b(QID|four times|4 times)\b/i.test(text)) return { timesPerDay: 3, clamped: true };
  if (/\b(TDS|TID|thrice|three times|3 times)\b/i.test(text)) return { timesPerDay: 3, clamped: false };
  if (/\b(BD|BID|twice|two times|2 times)\b/i.test(text)) return { timesPerDay: 2, clamped: false };
  if (/\b(OD|QD|once|one time|1 time)\b/i.test(text)) return { timesPerDay: 1, clamped: false };
  const generic = text.match(/\b(\d)\s*times?\s*(?:a|per|\/)\s*day\b/i);
  if (generic) {
    const count = Number(generic[1]);
    return { timesPerDay: clampTimes(count), clamped: count > 3 };
  }
  return { timesPerDay: null, clamped: false };
}

function clampTimes(count: number): number {
  return Math.min(Math.max(count, 0), 3);
}

export function parseDurationDays(text: string): number | null {
  const days = text.match(/(\d+)\s*(?:days?|d)\b/i);
  if (days) return Number(days[1]);
  const weeks = text.match(/(\d+)\s*(?:weeks?|wks?)\b/i);
  if (weeks) return Number(weeks[1]) * 7;
  return null;
}

// A dose is a number, at most one space, then a medicine unit that is not part of a lab unit such as g/dL.
const DOSE_PATTERN = /(\d+(?:\.\d+)?[ ]?(?:mg|mcg|g|ml|iu))(?![\w/])/i;
const PRESCRIPTION_PREFIX = /^\s*(\d+[.)]\s*)?(tab|cap|syp|inj|oint|drop|tablet|capsule|syrup)s?\.?\s+/i;

/**
 * Reads prescription lines such as "1. Tab. Paracetamol 500 mg - 1-0-1 - 5 days - after food".
 * Lines without a dose are ignored so headings and advice are not mistaken for medicines.
 */
export function extractPrescriptionData(text: string): { medications: ExtractedMedicine[]; warnings: string[] } {
  const medications: ExtractedMedicine[] = [];
  const warnings: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (!DOSE_PATTERN.test(rawLine)) continue;
    const hasPrefix = PRESCRIPTION_PREFIX.test(rawLine);
    const line = rawLine
      .replace(/^\s*\d+[.)]\s*/, "")
      .replace(/^\s*(tab|cap|syp|inj|oint|drop)s?\.?\s+/i, "")
      .trim();
    const parts = line.split(/\s+[-–|]\s+/).map((part) => part.trim()).filter(Boolean);
    // Without a "Tab./Cap." prefix or a dash-separated schedule, a dose-looking line is not a medicine.
    if (!hasPrefix && parts.length < 3) continue;
    const namePart = parts[0] ?? line;
    const doseMatch = namePart.match(DOSE_PATTERN);
    const name = namePart.replace(DOSE_PATTERN, "").replace(/[,;:]+$/, "").trim();
    if (!name || name.length > 120) continue;

    const frequencyPart = parts.find((part, index) => index > 0 && parseFrequency(part).timesPerDay !== null) ?? line;
    const frequency = parseFrequency(frequencyPart);
    if (frequency.clamped) warnings.push(`${name}: frequency shortened to 3 times a day. Please check it.`);
    if (frequency.timesPerDay === null) warnings.push(`${name}: frequency not read. Please check it.`);

    const durationPart = parts.find((part) => /days?|weeks?/i.test(part)) ?? line;
    const notePart = parts.find((part, index) => index > 0 && /food|meal|water|bed|morning|night/i.test(part)) ?? "";

    medications.push({
      name,
      dosage: doseMatch?.[1]?.replace(/\s+/g, " ") ?? "",
      frequency: frequencyPart === line ? "" : frequencyPart,
      timesPerDay: frequency.timesPerDay ?? 1,
      durationDays: parseDurationDays(durationPart),
      notes: notePart,
    });
  }

  return { medications, warnings };
}

// name ........ value  unit  reference range
const LAB_LINE = /^\s*([A-Za-z][A-Za-z0-9 .()%\-/]{2,60}?)\s+(\d{2,3}\/\d{2,3}|\d+(?:\.\d+)?)\s*(.*?)\s*$/;
const NON_LAB_PREFIX = /^(sample|report|patient|date|age|referred|page|name|lab|visit|rx|diagnosis|advice|vitals)\b/i;

/** Reads lab rows such as "Haemoglobin (Hb)   11.0   g/dL   12.0 - 16.0" into value, unit and range. */
export function extractLabValues(text: string): ExtractedLabValue[] {
  const rows: ExtractedLabValue[] = [];
  for (const line of text.split(/\r?\n/)) {
    // Medicine lines contain a dose followed by a space, not a unit like mg/dL. Skip them here.
    if (/\d\s*(mg|mcg|ml|iu)(?![/a-z])/i.test(line) && !/\/dl|\/l/i.test(line)) continue;
    const match = line.match(LAB_LINE);
    if (!match) continue;
    const testName = (match[1] ?? "").trim();
    const value = (match[2] ?? "").trim();
    if (NON_LAB_PREFIX.test(testName)) continue;

    const rest = (match[3] ?? "").trim();
    const [firstToken = "", ...restTokens] = rest.split(/\s+/);
    const hasUnit = firstToken !== "" && /^[A-Za-zµ%/][^\s]*$/.test(firstToken) && !/^(<|>)/.test(firstToken);
    const unit = hasUnit ? firstToken : "";
    const referenceRange = (hasUnit ? restTokens.join(" ") : rest).trim();

    rows.push({
      testName,
      value,
      unit,
      referenceRange: /\d/.test(referenceRange) || /^[<>]/.test(referenceRange) ? referenceRange : "",
    });
  }
  return rows;
}

/** Classifies a document from its vocabulary. Used to pick the title and default type. */
export function classifyDocument(text: string): DocumentType {
  const labVocabulary = (text.match(/\b(haemoglobin|hemoglobin|glucose|cholesterol|vitamin d|platelet|rbc|wbc|mcv|diagnostics|mg\/dl|g\/dl|ng\/ml)\b/gi) ?? []).length;
  const prescriptionMarkers = (text.match(/^\s*(\d+[.)]\s*)?(rx\b|tab\.?|cap\.?|syp\.?|tablet|capsule)/gim) ?? []).length;
  const visitMarkers = /\b(visit|outpatient|opd|consultation|follow[- ]?up|vitals)\b/i.test(text);

  if (labVocabulary >= 3) return "LAB_REPORT";
  if (prescriptionMarkers > 0) return "PRESCRIPTION";
  if (visitMarkers) return "DOCTOR_VISIT";
  if (labVocabulary > 0) return "LAB_REPORT";
  return "OTHER";
}

export const DEFAULT_TITLES: Record<DocumentType, string> = {
  PRESCRIPTION: "Prescription",
  LAB_REPORT: "Blood Report",
  DOCTOR_VISIT: "Doctor Visit",
  OTHER: "Medical Document",
};
