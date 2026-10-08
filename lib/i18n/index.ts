import { en, type MessageKey } from "./en";
import { hi } from "./hi";

export type Locale = "en" | "hi";
export const LOCALES: readonly Locale[] = ["en", "hi"] as const;
export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, hi };

export type MessageVars = Record<string, string | number>;

/**
 * Translates a key for a locale. Placeholders use {name}.
 * Falls back to English if a translation is ever missing at runtime.
 */
export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const template = dictionaries[locale][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "hi";
}

export type Translator = (key: MessageKey, vars?: MessageVars) => string;

export function createTranslator(locale: Locale): Translator {
  return (key, vars) => translate(locale, key, vars);
}

/** BCP-47 tag used for Intl formatting and speech synthesis. */
export function localeTag(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}
