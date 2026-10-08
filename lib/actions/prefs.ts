"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PREFS_COOKIE, mergePrefs, parsePrefs, prefsPatchSchema, type Prefs, type PrefsPatch } from "@/lib/prefs/prefs";
import type { ActionResult } from "@/types";

const COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
};

/** Saves accessibility, language and notification preferences in a cookie (no personal data). */
export async function updatePrefsAction(patch: PrefsPatch): Promise<ActionResult<Prefs>> {
  const parsed = prefsPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, errorKey: "error.actionFailed" };
  const store = await cookies();
  const current = parsePrefs(store.get(PREFS_COOKIE)?.value);
  const next = mergePrefs(parsed.data, current);
  store.set(PREFS_COOKIE, JSON.stringify(next), COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  return { ok: true, data: next };
}
