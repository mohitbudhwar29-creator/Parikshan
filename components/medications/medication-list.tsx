"use client";

import * as React from "react";
import { BellRing, FileText, PenLine, Trash2 } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import type { MedicationStatus } from "@/lib/health/medication-schedule";
import { frequencyLabelKey } from "@/lib/health/medication-schedule";
import { deleteMedicationAction } from "@/lib/actions/medications";
import { formatDate } from "@/lib/i18n/format";
import type { MedicineCardData } from "@/lib/medications/view";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { DoseToggles } from "./dose-toggles";
import { cn } from "@/lib/utils";

type Filter = "ALL" | MedicationStatus;
const FILTERS: Filter[] = ["ALL", "ACTIVE", "UPCOMING", "COMPLETED"];

const STATUS_LABEL: Record<MedicationStatus, MessageKey> = {
  ACTIVE: "meds.status.active",
  UPCOMING: "meds.status.upcoming",
  COMPLETED: "meds.status.completed",
};

export function MedicationList({ medicines }: { medicines: MedicineCardData[] }) {
  const { t, prefs } = usePrefs();
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [demoReminder, setDemoReminder] = React.useState<string | null>(null);
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());
  const [, startTransition] = React.useTransition();

  const visible = medicines.filter((medicine) => !removed.has(medicine.id) && (filter === "ALL" || medicine.status === filter));

  function remove(medicine: MedicineCardData) {
    if (!window.confirm(t("meds.deleteConfirm"))) return;
    setRemoved((current) => new Set(current).add(medicine.id));
    startTransition(async () => {
      await deleteMedicationAction(medicine.id);
    });
  }

  return (
    <div className="space-y-5">
      <div role="group" aria-label={t("meds.filter.all")} className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const label = item === "ALL" ? t("meds.filter.all") : t(STATUS_LABEL[item]);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-semibold",
                filter === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("meds.noneInFilter")}</p> : null}

      <ul className="grid gap-4 md:grid-cols-2">
        {visible.map((medicine) => (
          <li key={medicine.id}>
            <Card className="h-full">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-lg font-bold">{medicine.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {medicine.dosage} · {t(frequencyLabelKey(medicine.timesPerDay))}
                    </p>
                  </div>
                  <Badge variant={medicine.status === "ACTIVE" ? "success" : medicine.status === "UPCOMING" ? "info" : "neutral"}>
                    {t(STATUS_LABEL[medicine.status])}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("meds.duration")}</dt>
                    <dd>{medicine.durationDays ? t("meds.durationDays", { count: medicine.durationDays }) : t("meds.ongoing")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("meds.startDate")}</dt>
                    <dd>{formatDate(new Date(medicine.startDate), prefs.lang, "short")}</dd>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                    {medicine.sourceTitle ? <FileText className="size-4" aria-hidden /> : <PenLine className="size-4" aria-hidden />}
                    {medicine.sourceTitle ? t("meds.fromRecord", { title: medicine.sourceTitle }) : t("meds.sourceManual")}
                  </div>
                  {medicine.notes ? <p className="col-span-2 text-muted-foreground">{medicine.notes}</p> : null}
                </dl>
                {medicine.status === "ACTIVE" && medicine.scheduledSlots.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{t("meds.today")}</p>
                    <DoseToggles
                      medicationId={medicine.id}
                      medicineName={medicine.name}
                      scheduledSlots={medicine.scheduledSlots}
                      takenSlots={medicine.takenSlots}
                    />
                    <p className="text-xs text-muted-foreground">{t("meds.doseCount", { taken: medicine.takenSlots.length, total: medicine.scheduledSlots.length })}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {prefs.medicineReminders ? (
                    <Button variant="outline" size="sm" onClick={() => setDemoReminder(t("meds.reminderBody", { name: medicine.name, dosage: medicine.dosage }))}>
                      <BellRing aria-hidden /> {t("meds.reminderTest")}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => remove(medicine)}>
                    <Trash2 aria-hidden /> {t("meds.remove")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {demoReminder ? (
        <Alert variant="info" role="status">
          <BellRing className="size-5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">{demoReminder}</p>
            <p className="text-xs">{t("meds.reminderDemo")}</p>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}
