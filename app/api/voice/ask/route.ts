import { z } from "zod";
import { authenticatedUserId, cookieFromRequest } from "@/lib/voice/auth";
import { PROFILE_COOKIE } from "@/lib/prefs/prefs";
import { findProfileForUser, resolveActiveProfile } from "@/lib/database/profiles";
import { answerFromRecords } from "@/lib/voice/answer";
import { getVoiceConfig } from "@/lib/voice/config";
import { consumeRateLimit } from "@/lib/voice/rate-limit";
import { normalizeQuestion } from "@/lib/voice/guard";
import { voiceError, voiceJson } from "@/lib/voice/http";
import { VoiceProviderError } from "@/lib/voice/types";
import { idSchema } from "@/lib/validation/schemas";
import { logSafe } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_CHARACTERS = 16_384;

const bodySchema = z.object({
  question: z.string().min(1).max(1000),
  locale: z.enum(["en", "hi"]),
  profileId: idSchema.optional(),
  history: z.array(z.object({ question: z.string().max(500) })).max(4).optional(),
});

/**
 * POST /api/voice/ask. Typed and spoken questions both use this endpoint.
 * The profile is chosen server-side: an explicit profileId must belong to the signed-in user, otherwise the
 * request fails with "not found" (the response does not reveal whether it exists). Without one, the active
 * profile is resolved exactly as the pages do, from the phc_profile cookie with the same ownership rules.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return voiceError("voice.errorSignIn");

  const config = getVoiceConfig();
  const limit = consumeRateLimit(`ask:${userId}`, config.rateLimitPerMinute);
  if (!limit.ok) return voiceError("voice.errorRateLimit", { retryAfterSeconds: limit.retryAfterSeconds });

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARACTERS) return voiceError("voice.errorTooLarge");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return voiceError("voice.errorInvalid");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return voiceError("voice.errorInvalid");

  const question = normalizeQuestion(parsed.data.question);
  if (!question) return voiceError("voice.errorInvalid");

  const profile = parsed.data.profileId
    ? await findProfileForUser(userId, parsed.data.profileId)
    : await resolveActiveProfile(userId, cookieFromRequest(request, PROFILE_COOKIE));
  if (!profile) return voiceError("voice.errorNotFound");

  try {
    const answer = await answerFromRecords({
      userId,
      profile,
      question,
      locale: parsed.data.locale,
      history: parsed.data.history?.map((turn) => ({ question: turn.question })),
    });
    return voiceJson(answer);
  } catch (error) {
    if (error instanceof VoiceProviderError && error.code === "timeout") return voiceError("voice.errorTimeout");
    logSafe("voice ask failed", error);
    return voiceError("voice.errorAnswer");
  }
}
