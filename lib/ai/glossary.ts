import type { MessageKey } from "@/lib/i18n/en";

export interface GlossaryEntry {
  /** Words a user or document might use for this term (English and Hindi). */
  match: RegExp;
  explanationKey: MessageKey;
}

// Plain-language explanations. They describe what a term means and never give a diagnosis.
export const GLOSSARY: GlossaryEntry[] = [
  { match: /haemoglobin|hemoglobin|हीमोग्लोबिन|हिमोग्लोबिन|\bhb\b/i, explanationKey: "gloss.hemoglobin" },
  { match: /anemi|anaemi|एनीमिया/i, explanationKey: "gloss.anemia" },
  { match: /glucose|sugar|शुगर|शर्करा|ग्लूकोज/i, explanationKey: "gloss.glucose" },
  { match: /blood pressure|\bbp\b|रक्तचाप|बीपी/i, explanationKey: "gloss.bloodPressure" },
  { match: /vitamin ?d|विटामिन/i, explanationKey: "gloss.vitaminD" },
  { match: /cholesterol|कोलेस्ट्रॉल/i, explanationKey: "gloss.cholesterol" },
  { match: /heart rate|pulse|हृदय गति|नाड़ी/i, explanationKey: "gloss.heartRate" },
  { match: /weight|वजन/i, explanationKey: "gloss.weight" },
  { match: /\brbc\b|red blood/i, explanationKey: "gloss.rbc" },
  { match: /\bwbc\b|white blood/i, explanationKey: "gloss.wbc" },
  { match: /platelet/i, explanationKey: "gloss.platelets" },
  { match: /\bmcv\b/i, explanationKey: "gloss.mcv" },
  { match: /reference range|normal range|संदर्भ सीमा/i, explanationKey: "gloss.referenceRange" },
  { match: /interaction|आपसी क्रिया/i, explanationKey: "gloss.interaction" },
];

export function findGlossaryEntry(term: string): GlossaryEntry | null {
  return GLOSSARY.find((entry) => entry.match.test(term)) ?? null;
}
