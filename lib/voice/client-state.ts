// Pure state machine for the voice input and output controls. The React hooks only feed it events,
// which keeps every transition (permission denied, background, timeout, provider failure) testable.

export type VoicePhase = "idle" | "requesting" | "listening" | "processing" | "speaking" | "error" | "permission-denied" | "unsupported";

export type VoiceErrorCode =
  | "permission"
  | "unsupported"
  | "noMicrophone"
  | "noSpeech"
  | "empty"
  | "network"
  | "provider"
  | "timeout"
  | "tooLong"
  | "rateLimit"
  | "paused"
  | "unsupportedAudio";

export interface VoiceState {
  phase: VoicePhase;
  error: VoiceErrorCode | null;
  liveTranscript: string;
}

export type VoiceEvent =
  | { type: "REQUEST" }
  | { type: "LISTENING" }
  | { type: "LIVE"; text: string }
  | { type: "FINAL"; text: string }
  | { type: "PROCESSING" }
  | { type: "SPEAK" }
  | { type: "DONE" }
  | { type: "FAIL"; error: VoiceErrorCode }
  | { type: "PAUSE" }
  | { type: "RESET" };

export const INITIAL_VOICE_STATE: VoiceState = { phase: "idle", error: null, liveTranscript: "" };

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case "REQUEST":
      return { phase: "requesting", error: null, liveTranscript: "" };
    case "LISTENING":
      return { ...state, phase: "listening", error: null };
    case "LIVE":
      return { ...state, liveTranscript: event.text };
    case "FINAL": {
      // An empty or noise-only transcript is an error, never a question sent to the assistant.
      if (event.text.trim().length === 0) return { phase: "error", error: "empty", liveTranscript: "" };
      return { phase: "processing", error: null, liveTranscript: event.text };
    }
    case "PROCESSING":
      return { ...state, phase: "processing", error: null };
    case "SPEAK":
      return { ...state, phase: "speaking", error: null };
    case "DONE":
      return { ...state, phase: "idle", error: null };
    case "PAUSE":
      return { phase: "idle", error: "paused", liveTranscript: "" };
    case "FAIL":
      if (event.error === "permission") return { phase: "permission-denied", error: "permission", liveTranscript: state.liveTranscript };
      if (event.error === "unsupported") return { phase: "unsupported", error: "unsupported", liveTranscript: state.liveTranscript };
      if (event.error === "paused") return { phase: "idle", error: "paused", liveTranscript: state.liveTranscript };
      return { phase: "error", error: event.error, liveTranscript: state.liveTranscript };
    case "RESET":
      return INITIAL_VOICE_STATE;
  }
}

/** Maps a SpeechRecognition error code to our state. Returns null for codes that are not errors (user stop). */
export function mapRecognitionError(code: string): VoiceErrorCode | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "permission";
    case "no-speech":
      return "noSpeech";
    case "audio-capture":
      return "noMicrophone";
    case "network":
      return "network";
    case "language-not-supported":
      return "unsupported";
    case "aborted":
      return null;
    default:
      return "provider";
  }
}

/** Maps an error key returned by /api/voice/* to a state error. */
export function mapVoiceApiError(errorKey: string): VoiceErrorCode {
  switch (errorKey) {
    case "voice.errorRateLimit":
      return "rateLimit";
    case "voice.errorTimeout":
      return "timeout";
    case "voice.noSpeech":
      return "noSpeech";
    case "voice.error.empty":
      return "empty";
    case "voice.errorTooLarge":
      return "tooLong";
    case "voice.errorUnsupportedAudio":
      return "unsupportedAudio";
    default:
      return "provider";
  }
}
