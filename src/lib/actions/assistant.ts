"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/database/client";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveProfile } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/auth/guards";
import { answerQuestionSafely } from "@/lib/ai";
import { getAIContext } from "@/lib/database/queries";
import { chatAskSchema } from "@/lib/validation";
import type { ChatSource } from "@/types/domain";

/**
 * AI assistant.
 *
 * The context is built strictly from the active profile's stored records, so a
 * question can only ever be answered from data the user actually uploaded. When
 * the answer is not in the records the provider returns `grounded: false` and
 * the UI shows "I couldn't find that information in your uploaded records."
 */
export async function askAssistantAction(input: unknown): Promise<
  | { ok: true; answer: string; sources: ChatSource[]; grounded: boolean; provider: string; isMock: boolean }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const parsed = chatAskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "QUESTION_TOO_SHORT" };

  const profile = await getActiveProfile(user.id);
  const language = user.preferences?.language === "hi" ? "hi" : "en";

  const context = await getAIContext(profile.id, { name: profile.name, kind: profile.kind }, language);
  const response = await answerQuestionSafely({
    context,
    question: parsed.data.question,
    language,
  });

  await prisma.chatMessage.create({
    data: {
      profileId: profile.id,
      role: "user",
      content: parsed.data.question,
    },
  });
  await prisma.chatMessage.create({
    data: {
      profileId: profile.id,
      role: "assistant",
      content: response.content,
      sources: JSON.stringify(response.sources),
      intent: response.intent,
      grounded: response.grounded,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "assistant.ask",
    entityType: "HealthProfile",
    entityId: profile.id,
    meta: { intent: response.intent, grounded: response.grounded, provider: response.provider },
  });

  revalidatePath("/assistant");
  return {
    ok: true,
    answer: response.content,
    sources: response.sources,
    grounded: response.grounded,
    provider: response.provider,
    isMock: response.isMock,
  };
}

export async function clearChatAction(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const profile = await getActiveProfile(user.id);
  await prisma.chatMessage.deleteMany({ where: { profileId: profile.id } });
  revalidatePath("/assistant");
  return { ok: true };
}

/** Standalone term explainer used by the "what does this mean" chips. */
export async function explainTermAction(term: string): Promise<{ ok: boolean; explanation?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const language = user.preferences?.language === "hi" ? "hi" : "en";
  const { getHealthAIProvider } = await import("@/lib/ai");
  const explanation = await getHealthAIProvider().explainMedicalTerm(term, language);
  return { ok: true, explanation };
}
