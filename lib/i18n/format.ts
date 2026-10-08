import { localeTag, type Locale } from "./index";

// Health dates are calendar days stored as UTC midnight, so they are formatted in UTC.
const UTC = "UTC";

export function formatDate(date: Date, locale: Locale, style: "short" | "long" = "long"): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: UTC,
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(date);
}

export function formatMonthDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: UTC,
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits }).format(value);
}

/** Formats a date for an <input type="date"> value (YYYY-MM-DD) in UTC. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}
