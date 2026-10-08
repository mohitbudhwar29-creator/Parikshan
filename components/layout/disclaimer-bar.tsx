"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";

const STORAGE_KEY = "phc_disclaimer_collapsed";

/**
 * Global medical disclaimer. It can be hidden to a compact strip, but it is never removed.
 * The choice is remembered on this device.
 */
export function DisclaimerBar() {
  const { t } = usePrefs();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <div role="region" aria-label="Medical disclaimer" className="border-b border-warning/40 bg-warning-soft text-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className="size-4 shrink-0 text-warning" aria-hidden />
          <span>{collapsed ? t("disclaimer.short") : t("disclaimer.full")}</span>
        </p>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronUp className="size-3.5" aria-hidden />}
          {collapsed ? t("disclaimer.show") : t("disclaimer.dismiss")}
        </button>
      </div>
    </div>
  );
}
