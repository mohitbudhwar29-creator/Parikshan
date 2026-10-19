// Input guards for spoken and typed questions. Transcripts and document text are untrusted data:
// nothing here executes instructions, and every classification fails closed toward a safe reply.

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g;

/** Normalises a question: Unicode NFC, no control or zero-width characters, single spaces, max 500 chars. */
export function normalizeQuestion(input: string): string {
  return input.normalize("NFC").replace(CONTROL_CHARACTERS, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

export type QuestionKind = "answerable" | "emergency" | "action" | "injection" | "empty";

// Emergency wording is checked first, so a question about chest pain never gets a records answer.
const EMERGENCY = /chest pain|can'?t breathe|cannot breathe|can not breathe|difficulty breathing|trouble breathing|severe bleeding|heavy bleeding|unconscious|not breathing|heart attack|stroke|overdose|took too many|suicid|kill myself|want to die|seizure|सीने में दर्द|सांस नहीं|साँस नहीं|सांस लेने में|बेहोश|भारी खून|ज्यादा दवा|ज़्यादा दवा|खुदकुशी|आत्महत्या/i;

// Requests to change, delete, share, export or confirm anything. Voice never performs these.
const ACTION = /\b(delete|erase|remove|share|email|send|export|download|confirm|save|mark|log|cancel|upload|sign out|logout|take (my )?(dose|medicine|tablet))\b|हटा|मिटा|साझा|भेज|डाउनलोड|पुष्टि|सेव|चिह्नित|दर्ज/i;

// Attempts to override instructions or reach other people's data.
const INJECTION = /ignore (all |any |the |your |these |those |previous |prior |above |earlier )*(instructions|prompts?|messages|rules|guidelines|safety)|disregard (all |the |your )?(previous|above|prior|rules|instructions)|system prompt|you are now|act as (an? )?(admin|administrator|developer|doctor)|developer mode|reveal (your|the) (instructions|prompt)|\b(all|every|each|any) (patients?|users?|accounts?|profiles?|people|persons?)('s|s')?\b|\b(other|another|someone else'?s?|other people'?s?) (users?|patients?|people|records?|data|reports?|accounts?)\b|सभी (मरीज|उपयोगकर्ता|लोगों)|दूसरे (मरीज|उपयोगकर्ता|लोगों)|(system|सिस्टम) (प्रॉम्प्ट|निर्देश)/i;

export function classifyQuestion(question: string): QuestionKind {
  const text = normalizeQuestion(question);
  if (!text) return "empty";
  if (EMERGENCY.test(text)) return "emergency";
  if (INJECTION.test(text)) return "injection";
  if (ACTION.test(text)) return "action";
  return "answerable";
}

/** Transcripts with no letters or digits (only punctuation or noise) are not questions. */
export function isMeaningfulTranscript(text: string): boolean {
  const normalized = normalizeQuestion(text);
  return /[\p{L}\p{N}]{2,}/u.test(normalized);
}

/** Pronouns that point back at a previous question, such as "and that one?" */
export const FOLLOW_UP_HINT = /\b(that|this|it|those|these|previous|earlier|before|also|and what about)\b|इसका|उसका|इसके|उसके|पिछला|पिछली|वही/i;
