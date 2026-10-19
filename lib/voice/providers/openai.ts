import { VoiceProviderError } from "../types";
import type { AudioFormat } from "../audio";
import { mimeForAudioFormat } from "../audio";

// Server-side calls to the OpenAI speech endpoints. The API key is read by the caller and passed in;
// it is never returned, logged, or included in an error message.
//   Speech to text: POST https://api.openai.com/v1/audio/transcriptions   (multipart, field "file")
//   Text to speech: POST https://api.openai.com/v1/audio/speech            (JSON, returns audio bytes)

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const SPEECH_URL = "https://api.openai.com/v1/audio/speech";
export const STT_TIMEOUT_MS = 20_000;
export const TTS_TIMEOUT_MS = 20_000;
export const MAX_SPOKEN_CHARACTERS = 1500;

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function send(url: string, init: RequestInit, fetchImpl: FetchLike, timeoutMs: number): Promise<Response> {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new VoiceProviderError("timeout", "speech provider timed out");
    throw new VoiceProviderError("provider", "speech provider unreachable");
  } finally {
    clear();
  }
}

export async function transcribeWithOpenAI(args: {
  audio: Uint8Array;
  format: AudioFormat;
  locale: "en" | "hi";
  apiKey: string;
  model: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<string> {
  const form = new FormData();
  const copy = new Uint8Array(args.audio.byteLength);
  copy.set(args.audio);
  form.append("file", new Blob([copy], { type: mimeForAudioFormat(args.format) }), `speech.${args.format}`);
  form.append("model", args.model);
  form.append("language", args.locale);
  form.append("response_format", "json");

  const response = await send(
    TRANSCRIBE_URL,
    { method: "POST", headers: { Authorization: `Bearer ${args.apiKey}` }, body: form },
    args.fetchImpl ?? fetch,
    args.timeoutMs ?? STT_TIMEOUT_MS,
  );
  if (!response.ok) throw new VoiceProviderError("provider", "speech-to-text provider returned an error", response.status);

  const body = (await response.json().catch(() => null)) as { text?: unknown } | null;
  if (!body || typeof body.text !== "string") throw new VoiceProviderError("invalid_response", "speech-to-text response had no text");
  return body.text;
}

export async function synthesizeWithOpenAI(args: {
  text: string;
  apiKey: string;
  model: string;
  voice: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<ArrayBuffer> {
  if (args.text.length === 0 || args.text.length > MAX_SPOKEN_CHARACTERS) {
    throw new VoiceProviderError("invalid_response", "text outside the allowed length for speech");
  }
  const response = await send(
    SPEECH_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: args.model, voice: args.voice, input: args.text, response_format: "mp3" }),
    },
    args.fetchImpl ?? fetch,
    args.timeoutMs ?? TTS_TIMEOUT_MS,
  );
  if (!response.ok) throw new VoiceProviderError("provider", "text-to-speech provider returned an error", response.status);
  return response.arrayBuffer();
}
