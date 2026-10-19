import { z } from "zod";
import { createTranslator } from "@/lib/i18n";
import { authenticatedUserId } from "@/lib/voice/auth";
import { getVoiceConfig } from "@/lib/voice/config";
import { consumeRateLimit } from "@/lib/voice/rate-limit";
import { synthesizeOnServer } from "@/lib/voice/providers";
import { verifySpeechToken } from "@/lib/voice/speech-token";
import { voiceError } from "@/lib/voice/http";
import { VoiceProviderError } from "@/lib/voice/types";
import { logSafe } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1).max(1000),
  locale: z.enum(["en", "hi"]),
  token: z.string().min(10).max(200),
});

/**
 * POST /api/voice/speak. Reads an answer aloud with the server's speech provider.
 * Only text that this server issued for the same signed-in user can be spoken (see speech-token.ts),
 * so the endpoint cannot be used to make the provider read arbitrary text.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return voiceError("voice.errorSignIn");

  const config = getVoiceConfig();
  if (config.tts !== "server") return voiceError("voice.serverTtsOff");
  const limit = consumeRateLimit(`tts:${userId}`, config.rateLimitPerMinute);
  if (!limit.ok) return voiceError("voice.errorRateLimit", { retryAfterSeconds: limit.retryAfterSeconds });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return voiceError("voice.errorInvalid");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return voiceError("voice.errorInvalid");
  if (!verifySpeechToken(userId, parsed.data.text, parsed.data.token)) return voiceError("voice.errorInvalid");

  const t = createTranslator(parsed.data.locale);
  const spoken = `${parsed.data.text} ${t("voice.spokenDisclaimer")}`;
  try {
    const audio = await synthesizeOnServer({ text: spoken });
    return new Response(audio, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof VoiceProviderError && error.code === "timeout") return voiceError("voice.errorTimeout");
    if (error instanceof VoiceProviderError && error.code === "not_configured") return voiceError("voice.serverTtsOff");
    logSafe("voice speak failed", error);
    return voiceError("voice.errorProvider");
  }
}
