// Voice configuration. Read on the server only. The browser receives just the resolved modes.
//
// VOICE_STT_PROVIDER / VOICE_TTS_PROVIDER:
//   browser (default) - the browser's built-in speech APIs (Web Speech). No server keys are needed.
//                       Chrome and Edge send audio to their speech service; Safari and Firefox differ.
//   openai            - audio goes to the OpenAI speech API from the server. Needs OPENAI_API_KEY.
//   off               - no speech for that direction. The text box is always available.
//
// A provider set to "openai" without a key is treated as "off" and reported as misconfigured.
import type { VoiceErrorKey } from "./types";

export type SpeechMode = "browser" | "server" | "off";

export interface VoiceConfig {
  enabled: boolean;
  stt: SpeechMode;
  tts: SpeechMode;
  misconfigured: string[];
  openai: {
    apiKey: string | null;
    sttModel: string;
    ttsModel: string;
    ttsVoice: string;
  };
  maxAudioBytes: number;
  rateLimitPerMinute: number;
}

const DEFAULT_MAX_AUDIO_BYTES = 5 * 1024 * 1024;

function providerValue(name: string, fallback: "browser" | "openai" | "off"): "browser" | "openai" | "off" {
  const raw = (process.env[name] ?? fallback).trim().toLowerCase();
  if (raw === "browser" || raw === "openai" || raw === "off") return raw;
  return fallback;
}

export function getVoiceConfig(): VoiceConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;
  const misconfigured: string[] = [];
  const enabled = (process.env.VOICE_ENABLED ?? "true").trim().toLowerCase() !== "false";

  const resolve = (name: string): SpeechMode => {
    const provider = providerValue(name, "browser");
    if (provider === "off") return "off";
    if (provider === "browser") return "browser";
    if (!apiKey) {
      misconfigured.push(name);
      return "off";
    }
    return "server";
  };

  const maxBytes = Number(process.env.VOICE_MAX_AUDIO_BYTES ?? DEFAULT_MAX_AUDIO_BYTES);
  const perMinute = Number(process.env.VOICE_RATE_LIMIT_PER_MINUTE ?? 20);

  return {
    enabled,
    stt: enabled ? resolve("VOICE_STT_PROVIDER") : "off",
    tts: enabled ? resolve("VOICE_TTS_PROVIDER") : "off",
    misconfigured,
    openai: {
      apiKey,
      sttModel: process.env.VOICE_OPENAI_STT_MODEL?.trim() || "whisper-1",
      ttsModel: process.env.VOICE_OPENAI_TTS_MODEL?.trim() || "tts-1",
      ttsVoice: process.env.VOICE_OPENAI_TTS_VOICE?.trim() || "alloy",
    },
    maxAudioBytes: Number.isFinite(maxBytes) && maxBytes > 0 ? Math.min(maxBytes, 20 * 1024 * 1024) : DEFAULT_MAX_AUDIO_BYTES,
    rateLimitPerMinute: Number.isFinite(perMinute) && perMinute > 0 ? Math.min(perMinute, 600) : 20,
  };
}

/** The only voice settings the browser may see. Contains no keys. */
export function publicVoiceModes(config: VoiceConfig = getVoiceConfig()): { stt: SpeechMode; tts: SpeechMode } {
  return { stt: config.stt, tts: config.tts };
}

export function voiceErrorStatus(key: VoiceErrorKey): number {
  switch (key) {
    case "voice.errorSignIn":
      return 401;
    case "voice.errorNotFound":
      return 404;
    case "voice.errorRateLimit":
      return 429;
    case "voice.errorTooLarge":
      return 413;
    case "voice.errorUnsupportedAudio":
      return 415;
    case "voice.serverSttOff":
    case "voice.serverTtsOff":
      return 409;
    case "voice.errorTimeout":
      return 504;
    case "voice.error.empty":
    case "voice.noSpeech":
      return 422;
    case "voice.errorProvider":
    case "voice.errorAnswer":
      return 502;
    default:
      return 400;
  }
}
