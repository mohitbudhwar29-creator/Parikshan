import { authenticatedUserId } from "@/lib/voice/auth";
import { getVoiceConfig } from "@/lib/voice/config";
import { consumeRateLimit } from "@/lib/voice/rate-limit";
import { detectAudioFormat, MIN_AUDIO_BYTES } from "@/lib/voice/audio";
import { transcribeOnServer } from "@/lib/voice/providers";
import { isMeaningfulTranscript, normalizeQuestion } from "@/lib/voice/guard";
import { voiceError, voiceJson } from "@/lib/voice/http";
import { VoiceProviderError } from "@/lib/voice/types";
import { logSafe } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/voice/transcribe (multipart: "audio", "locale").
 * Used only when server-side speech-to-text is configured. The audio is held in memory for the
 * provider call and then dropped: it is never written to disk or to the database, and it is never logged.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return voiceError("voice.errorSignIn");

  const config = getVoiceConfig();
  if (config.stt !== "server") return voiceError("voice.serverSttOff");
  const limit = consumeRateLimit(`stt:${userId}`, config.rateLimitPerMinute);
  if (!limit.ok) return voiceError("voice.errorRateLimit", { retryAfterSeconds: limit.retryAfterSeconds });

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > config.maxAudioBytes + 64 * 1024) return voiceError("voice.errorTooLarge");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return voiceError("voice.errorInvalid");
  }
  const audio = form.get("audio");
  const locale = form.get("locale");
  if (!(audio instanceof File) || (locale !== "en" && locale !== "hi")) return voiceError("voice.errorInvalid");
  if (audio.size < MIN_AUDIO_BYTES) return voiceError("voice.error.empty");
  if (audio.size > config.maxAudioBytes) return voiceError("voice.errorTooLarge");

  const bytes = new Uint8Array(await audio.arrayBuffer());
  // The declared type is ignored. Only the file's own signature decides the format.
  const format = detectAudioFormat(bytes);
  if (!format) return voiceError("voice.errorUnsupportedAudio");

  try {
    const transcript = normalizeQuestion(await transcribeOnServer({ audio: bytes, format, locale }));
    if (!isMeaningfulTranscript(transcript)) return voiceError("voice.noSpeech");
    return voiceJson({ transcript });
  } catch (error) {
    if (error instanceof VoiceProviderError) {
      if (error.code === "timeout") return voiceError("voice.errorTimeout");
      if (error.code === "not_configured") return voiceError("voice.serverSttOff");
    }
    logSafe("voice transcribe failed", error);
    return voiceError("voice.errorProvider");
  }
}
