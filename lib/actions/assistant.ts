"use server";

import { interactionCheckSchema } from "@/lib/validation/schemas";
import { requireAppContext } from "@/lib/auth/context";
import { checkMedicineInteractions } from "@/lib/interactions";
import { logSafe } from "@/lib/logging";

// Assistant questions (typed or spoken) go through /api/voice/ask, which applies the same guards,
// ownership checks and rate limits for both input methods.

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
