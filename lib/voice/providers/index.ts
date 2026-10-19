import { getVoiceConfig } from "../config";
import { VoiceProviderError } from "../types";
import { transcribeWithOpenAI, synthesizeWithOpenAI, type FetchLike } from "./openai";
import type { AudioFormat } from "../audio";

// The single entry point the route handlers use. Adding a vendor means adding a function here
// and a branch in getVoiceConfig(); the routes and the UI stay the same.

export async function transcribeOnServer(args: {
  audio: Uint8Array;
  format: AudioFormat;
  locale: "en" | "hi";
  fetchImpl?: FetchLike;
}): Promise<string> {
  const config = getVoiceConfig();
  if (config.stt !== "server" || !config.openai.apiKey) throw new VoiceProviderError("not_configured", "server speech-to-text is off");
  return transcribeWithOpenAI({
    audio: args.audio,
    format: args.format,
    locale: args.locale,
    apiKey: config.openai.apiKey,
    model: config.openai.sttModel,
    fetchImpl: args.fetchImpl,
  });
}

export async function synthesizeOnServer(args: { text: string; fetchImpl?: FetchLike }): Promise<ArrayBuffer> {
  const config = getVoiceConfig();
  if (config.tts !== "server" || !config.openai.apiKey) throw new VoiceProviderError("not_configured", "server text-to-speech is off");
  return synthesizeWithOpenAI({
    text: args.text,
    apiKey: config.openai.apiKey,
    model: config.openai.ttsModel,
    voice: config.openai.ttsVoice,
    fetchImpl: args.fetchImpl,
  });
}
