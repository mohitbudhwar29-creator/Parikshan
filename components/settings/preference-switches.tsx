"use client";

import { usePrefs } from "@/components/prefs/prefs-provider";
import type { PrefsPatch } from "@/lib/prefs/prefs";
import { cn } from "@/lib/utils";

type SwitchKey = keyof Omit<PrefsPatch, "lang">;

/** Accessible on/off switches. Each change applies immediately and is saved in a cookie. */
export function PreferenceSwitches({ items }: { items: { key: SwitchKey; label: string; hint?: string }[] }) {
  const { prefs, setPrefs, t } = usePrefs();
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const on = Boolean(prefs[item.key]);
        return (
          <li key={item.key} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p id={`${item.key}-label`} className="font-semibold">{item.label}</p>
              {item.hint ? <p className="text-sm text-muted-foreground">{item.hint}</p> : null}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby={`${item.key}-label`}
              onClick={() => setPrefs({ [item.key]: !on })}
              className={cn(
                "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "bg-primary" : "bg-muted-foreground/40",
              )}
            >
              <span className={cn("inline-block size-6 rounded-full bg-white shadow transition-transform", on ? "translate-x-7" : "translate-x-1")} aria-hidden />
              <span className="sr-only">{on ? t("a11y.on") : t("a11y.off")}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
