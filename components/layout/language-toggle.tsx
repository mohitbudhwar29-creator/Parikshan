"use client";

import { Languages } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn } from "@/lib/utils";

/** Header language switch. Changes apply immediately and are saved in a cookie. */
export function LanguageToggle() {
  const { prefs, t, setPrefs } = usePrefs();
  const options = [
    { value: "en" as const, label: "English" },
    { value: "hi" as const, label: "हिन्दी" },
  ];
  return (
    <div role="group" aria-label={t("a11y.languageLabel")} className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
      <Languages className="ml-1 size-4 text-muted-foreground" aria-hidden />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={prefs.lang === option.value}
          onClick={() => setPrefs({ lang: option.value })}
          className={cn(
            "rounded-lg px-2.5 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            prefs.lang === option.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
