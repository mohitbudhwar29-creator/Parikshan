import type { MessageKey } from "@/lib/i18n/en";
import type { ValueFlag } from "@/types/health";

// Shared voice contracts. Everything here is safe to send to the browser: no keys, no raw audio.

export interface VoiceCitation {
  recordId: string;
  reportTitle: string;
  /** Date printed on the report, YYYY-MM-DD (UTC). */
  reportDate: string;
  /** Test name as stored (for example "Haemoglobin (Hb)"). Null when the source is the whole report. */
  testName: string | null;
  /** Value exactly as stored on the report, for example "11.0" or "120/80". */
  value: string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: ValueFlag | null;
}

export type VoiceLimitation = MessageKey;

/** Why an answer was refused before the AI was asked. Null for normal answers. */
export type VoiceBlockReason = "emergency" | "action" | "injection" | null;

export interface VoiceAnswer {
  answer: string;
  /** True only when the answer is backed by at least one citation from the user's saved records. */
  found: boolean;
  grounded: boolean;
  blocked: VoiceBlockReason;
  citations: VoiceCitation[];
  /** Translation keys describing what is missing, ambiguous or uncertain. The client translates them. */
  limitations: VoiceLimitation[];
  /** Signed token that lets the speak endpoint read exactly this answer text. */
  speechToken: string;
  provider: string;
}

export type VoiceErrorKey =
  | "voice.errorSignIn"
  | "voice.errorNotFound"
  | "voice.errorInvalid"
  | "voice.errorAnswer"
  | "voice.errorTooLarge"
  | "voice.errorUnsupportedAudio"
  | "voice.noSpeech"
  | "voice.serverSttOff"
  | "voice.serverTtsOff"
  | "voice.errorProvider"
  | "voice.errorTimeout"
  | "voice.errorRateLimit"
  | "voice.error.empty";

export class VoiceProviderError extends Error {
  constructor(
    readonly code: "timeout" | "provider" | "invalid_response" | "not_configured",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "VoiceProviderError";
  }
}
