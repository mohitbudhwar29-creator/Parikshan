// Maps brand and spelling variants to generic names used in the interaction dataset.
const SYNONYMS: Record<string, string> = {
  crocin: "paracetamol",
  calpol: "paracetamol",
  dolo: "paracetamol",
  acetaminophen: "paracetamol",
  amoxycillin: "amoxicillin",
  "vitamin d3": "vitamin d",
  cholecalciferol: "vitamin d",
  coumadin: "warfarin",
  "hydrochlorothiazide": "hydrochlorothiazide",
  "ibuprofen tablet": "ibuprofen",
  brufen: "ibuprofen",
  disprin: "aspirin",
  ecosprin: "aspirin",
};

export function normalizeMedicineName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)\b/g, "")
    .replace(/\b(tab|tablet|cap|capsule|syrup|injection|inj|oral)s?\b\.?/g, "")
    .replace(/[^a-z0-9 +]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return SYNONYMS[cleaned] ?? cleaned;
}
