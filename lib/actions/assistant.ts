"use server";

import { questionSchema } from "@/lib/validation/schemas";
import { requireAppContext } from "@/lib/auth/context";
import { buildHealthContext } from "@/lib/health/context";
import { answerQuestion } from "@/lib/ai";
import { checkMedicineInteractions } from "@/lib/interactions";
import { interactionCheckSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "@/types";
import type { AssistantAnswer } from "@/types/health";
import { logSafe } from "@/lib/logging";

/** Answers a question using only the active profile's saved records. */
export async function askAssistantAction(question: string): Promise<ActionResult<AssistantAnswer>> {
  const { profile, prefs } = await requireAppContext();
  const parsed = questionSchema.safeParse(question);
  if (!parsed.success) return { ok: false, errorKey: "error.actionFailed", detail: parsed.error.issues[0]?.message };
  try {
    const context = await buildHealthContext(profile);
    const answer = await answerQuestion({ context, question: parsed.data, locale: prefs.lang });
    return { ok: true, data: answer };
  } catch (error) {
    logSafe("askAssistant failed", error);
    return { ok: false, errorKey: "error.generic" };
  }
}

/** Checks pairs of medicines against the configured interaction provider (mock dataset in the demo). */
export async function checkInteractionsAction(medicines: string[]) {
  await requireAppContext();
  const parsed = interactionCheckSchema.safeParse({ medicines });
  if (!parsed.success) return { ok: false as const, errorKey: "interactions.needTwo" as const };
  try {
    const findings = await checkMedicineInteractions(parsed.data.medicines);
    return { ok: true as const, data: findings };
  } catch (error) {
    logSafe("checkInteractions failed", error);
    return { ok: false as const, errorKey: "interactions.errorGeneric" as const };
  }
}
