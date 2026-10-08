"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import type { DoseSlot } from "@/types/health";
import { slotLabelKey, slotTimeKey } from "@/lib/health/medication-schedule";
import { toggleDoseAction } from "@/lib/actions/medications";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn } from "@/lib/utils";

/** Tap-to-mark dose checkboxes for today. Updates instantly and is saved on the server. */
export function DoseToggles({
  medicationId,
  medicineName,
  scheduledSlots,
  takenSlots,
}: {
  medicationId: string;
  medicineName: string;
  scheduledSlots: DoseSlot[];
  takenSlots: DoseSlot[];
}) {
  const { t } = usePrefs();
  const [taken, setTaken] = React.useState<DoseSlot[]>(takenSlots);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setTaken(takenSlots);
  }, [takenSlots]);

  function toggle(slot: DoseSlot) {
    const next = !taken.includes(slot);
    setTaken((current) => (next ? [...current, slot] : current.filter((item) => item !== slot)));
    startTransition(async () => {
      const result = await toggleDoseAction(medicationId, slot, next);
      if (!result.ok) setTaken(takenSlots);
    });
  }

  if (scheduledSlots.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {scheduledSlots.map((slot) => {
        const done = taken.includes(slot);
        return (
          <button
            key={slot}
            type="button"
            onClick={() => toggle(slot)}
            aria-pressed={done}
            aria-label={`${t(slotLabelKey(slot))} · ${medicineName} · ${done ? t("meds.taken") : t("meds.notTaken")}`}
            className={cn(
              "flex min-h-[56px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
              done ? "border-success/40 bg-success-soft" : "border-border bg-card hover:bg-accent",
            )}
          >
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2", done ? "border-success bg-success text-white" : "border-muted-foreground/50")}>
              {done ? <Check className="size-4" aria-hidden /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t(slotLabelKey(slot))}</span>
              <span className="block text-xs text-muted-foreground">
                {t(slotTimeKey(slot) as MessageKey)} · {done ? t("meds.taken") : t("meds.notTaken")}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
