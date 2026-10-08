import { z } from "zod";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

// Shared between server and client: keep this file free of server-only imports.
export const PREFS_COOKIE = "phc_prefs";
export const PROFILE_COOKIE = "phc_profile";

export interface Prefs {
  lang: Locale;
  easyRead: boolean;
  largeText: boolean;
  highContrast: boolean;
  readAloud: boolean;
  medicineReminders: boolean;
  recordReminders: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  lang: DEFAULT_LOCALE,
  easyRead: false,
  largeText: false,
  highContrast: false,
  readAloud: true,
  medicineReminders: true,
  recordReminders: true,
};

export const prefsPatchSchema = z
  .object({
    lang: z.enum(["en", "hi"]),
    easyRead: z.boolean(),
    largeText: z.boolean(),
    highContrast: z.boolean(),
    readAloud: z.boolean(),
    medicineReminders: z.boolean(),
    recordReminders: z.boolean(),
  })
  .partial()
  .strict();

export type PrefsPatch = z.infer<typeof prefsPatchSchema>;

/** Parses the preferences cookie defensively; anything unexpected falls back to defaults. */
export function parsePrefs(raw: string | undefined | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = prefsPatchSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return DEFAULT_PREFS;
    return mergePrefs(parsed.data);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function mergePrefs(patch: PrefsPatch, base: Prefs = DEFAULT_PREFS): Prefs {
  const lang = patch.lang !== undefined && isLocale(patch.lang) ? patch.lang : base.lang;
  return { ...base, ...patch, lang };
}
