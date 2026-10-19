import { buildHealthContext } from "@/lib/health/context";
import { getHealthAIProvider } from "@/lib/ai/provider";
import type { HealthAIProvider, HealthContext } from "@/lib/ai/types";
import { createTranslator, type Locale } from "@/lib/i18n";
import { logSafe } from "@/lib/logging";
import { classifyQuestion, FOLLOW_UP_HINT, normalizeQuestion } from "./guard";
import { checkNumericGrounding, citationsFor, evidenceLimitations } from "./grounding";
import { createSpeechToken } from "./speech-token";
import { VoiceProviderError, type VoiceAnswer, type VoiceBlockReason, type VoiceLimitation } from "./types";

export interface HistoryTurn {
  question: string;
}

export interface GroundedQuestionInput {
  /** The signed-in user. Used to bind the speech token. */
  userId: string;
  /** Must already be verified as owned by userId. This function never chooses a profile itself. */
  profile: { id: string; name: string; relationship: string };
  question: string;
  locale: Locale;
  history?: HistoryTurn[];
  /** Upper bound for the AI provider call. */
  timeoutMs?: number;
  /** Test seam: replaces the configured AI provider. Production code never passes this. */
  provider?: Pick<HealthAIProvider, "name" | "answerQuestion">;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new VoiceProviderError("timeout", "AI provider timed out")), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function blockedAnswer(args: { userId: string; reason: Exclude<VoiceBlockReason, null>; text: string; provider: string }): VoiceAnswer {
  return {
    answer: args.text,
    found: false,
    grounded: false,
    blocked: args.reason,
    citations: [],
    limitations: [],
    speechToken: createSpeechToken(args.userId, args.text),
    provider: args.provider,
  };
}

/**
 * Answers one question from the profile's saved records only.
 *
 * Order of checks: emergency wording, then action and injection refusals, then retrieval,
 * then the AI provider, then one follow-up rewrite, then a grounding check on every number.
 * Anything that fails a check becomes an explicit limitation, never an invented answer.
 */
export async function answerFromRecords(input: GroundedQuestionInput): Promise<VoiceAnswer> {
  const t = createTranslator(input.locale);
  const question = normalizeQuestion(input.question);
  const provider = input.provider ?? getHealthAIProvider();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const kind = classifyQuestion(question);
  if (kind === "empty") throw new VoiceProviderError("not_configured", "empty question");
  if (kind === "emergency") {
    return blockedAnswer({ userId: input.userId, reason: "emergency", text: t("voice.emergency"), provider: provider.name });
  }
  if (kind === "action") {
    return blockedAnswer({ userId: input.userId, reason: "action", text: t("voice.actionBlocked"), provider: provider.name });
  }
  if (kind === "injection") {
    return blockedAnswer({ userId: input.userId, reason: "injection", text: t("voice.injectionBlocked"), provider: provider.name });
  }

  // Retrieval is scoped to one profile id that the caller has already checked for ownership.
  const context: HealthContext = await buildHealthContext(input.profile);
  if (context.records.length === 0) {
    const text = t("assistant.noRecords");
    return finish({ userId: input.userId, text, found: false, citations: [], limitations: ["voice.limit.missing"], provider: provider.name });
  }

  let result = await withTimeout(provider.answerQuestion({ context, question, locale: input.locale }), timeoutMs);

  // One follow-up rewrite: "and that one?" is answered with the previous question's subject.
  const previous = [...(input.history ?? [])].reverse().map((turn) => normalizeQuestion(turn.question)).find(Boolean);
  if (!result.found && previous && FOLLOW_UP_HINT.test(question) && classifyQuestion(previous) === "answerable") {
    const rewritten = `${previous}. ${question}`;
    const retry = await withTimeout(provider.answerQuestion({ context, question: rewritten, locale: input.locale }), timeoutMs);
    if (retry.found) {
      result = retry;
    }
  }

  if (!result.found) {
    const ambiguous = FOLLOW_UP_HINT.test(question) && !previous;
    return finish({
      userId: input.userId,
      text: result.answer,
      found: false,
      citations: [],
      limitations: [ambiguous ? "voice.limit.ambiguous" : "voice.limit.missing"],
      provider: provider.name,
    });
  }

  // Grounding: every number in the answer must come from this profile's data.
  const numeric = checkNumericGrounding(result.answer, context);
  if (!numeric.ok) {
    logSafe("voice grounding rejected an answer", new Error("unsupported_number"));
    return finish({
      userId: input.userId,
      text: t("voice.groundingFailed"),
      found: false,
      citations: [],
      limitations: ["voice.limit.missing"],
      provider: provider.name,
    });
  }

  // Keep only sources that really belong to this profile (defence in depth).
  const knownIds = new Set(context.records.map((record) => record.id));
  const sourceIds = [...new Set(result.sources.map((source) => source.recordId))].filter((id) => knownIds.has(id));
  if (sourceIds.length === 0) {
    return finish({
      userId: input.userId,
      text: t("voice.groundingFailed"),
      found: false,
      citations: [],
      limitations: ["voice.limit.missing"],
      provider: provider.name,
    });
  }

  const citations = citationsFor({ answer: result.answer, locale: input.locale, context, recordIds: sourceIds });
  const limitations = evidenceLimitations({ citations, context });
  // "What does that mean?" with nothing earlier to point at: the answer shows the latest report,
  // but the user must be told the question was ambiguous.
  if (FOLLOW_UP_HINT.test(question) && !previous) limitations.push("voice.limit.ambiguous");
  return finish({ userId: input.userId, text: result.answer, found: true, citations, limitations, provider: provider.name });
}

function finish(args: {
  userId: string;
  text: string;
  found: boolean;
  citations: VoiceAnswer["citations"];
  limitations: VoiceLimitation[];
  provider: string;
}): VoiceAnswer {
  return {
    answer: args.text,
    found: args.found,
    grounded: args.found && args.citations.length > 0,
    blocked: null,
    citations: args.citations,
    limitations: [...new Set(args.limitations)],
    speechToken: createSpeechToken(args.userId, args.text),
    provider: args.provider,
  };
}
