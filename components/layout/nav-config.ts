import type { MessageKey } from "@/lib/i18n/en";

export type NavIconName =
  | "dashboard"
  | "upload"
  | "timeline"
  | "assistant"
  | "trends"
  | "medications"
  | "interactions"
  | "family"
  | "settings";

export interface NavItem {
  href: string;
  labelKey: MessageKey;
  shortLabelKey?: MessageKey;
  icon: NavIconName;
}

/** Main navigation. Caregiver View is intentionally not listed here: it is reached from Family and the dashboard. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", shortLabelKey: "nav.home", icon: "dashboard" },
  { href: "/upload", labelKey: "nav.upload", shortLabelKey: "nav.uploadShort", icon: "upload" },
  { href: "/timeline", labelKey: "nav.timeline", icon: "timeline" },
  { href: "/assistant", labelKey: "nav.assistant", shortLabelKey: "nav.assistantShort", icon: "assistant" },
  { href: "/trends", labelKey: "nav.trends", shortLabelKey: "nav.trendsShort", icon: "trends" },
  { href: "/medications", labelKey: "nav.medications", shortLabelKey: "nav.medicinesShort", icon: "medications" },
  { href: "/interactions", labelKey: "nav.interactions", icon: "interactions" },
  { href: "/family", labelKey: "nav.family", icon: "family" },
  { href: "/settings", labelKey: "nav.settings", icon: "settings" },
];

/** Items shown in the phone bottom bar. Everything else is under "More". */
export const MOBILE_PRIMARY_HREFS = ["/dashboard", "/upload", "/assistant", "/trends", "/medications"];
