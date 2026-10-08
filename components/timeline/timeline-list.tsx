"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, FlaskConical, Pill, Search, Stethoscope, Calendar } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import { DOCUMENT_TYPES } from "@/types/health";
import { formatDate } from "@/lib/i18n/format";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  recordDate: string;
  doctorName: string;
  facility: string;
  labCount: number;
  medicineCount: number;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  PRESCRIPTION: Pill,
  LAB_REPORT: FlaskConical,
  DOCTOR_VISIT: Stethoscope,
  OTHER: FileText,
};

/** Filter, search and sort for saved records. Everything runs on the loaded list, so it is instant. */
export function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  const { t, prefs } = usePrefs();
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<string>("ALL");
  const [sort, setSort] = React.useState<"newest" | "oldest">("newest");

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => type === "ALL" || entry.type === type)
      .filter((entry) => {
        if (!needle) return true;
        const haystack = [entry.title, entry.doctorName, entry.facility, t(`record.type.${entry.type}` as MessageKey)].join(" ").toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => (sort === "newest" ? b.recordDate.localeCompare(a.recordDate) : a.recordDate.localeCompare(b.recordDate)));
  }, [entries, query, type, sort, t]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="timeline-search">{t("timeline.searchLabel")}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="timeline-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("timeline.searchPlaceholder")} className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timeline-type">{t("timeline.filterType")}</Label>
          <Select id="timeline-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="ALL">{t("timeline.filterAll")}</option>
            {DOCUMENT_TYPES.map((item) => (
              <option key={item} value={item}>{t(`record.type.${item}` as MessageKey)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timeline-sort">{t("timeline.sort")}</Label>
          <Select id="timeline-sort" value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")}>
            <option value="newest">{t("timeline.sortNewest")}</option>
            <option value="oldest">{t("timeline.sortOldest")}</option>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">{t("timeline.entries", { count: visible.length })}</p>

      {visible.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("timeline.noMatch")}</p> : null}

      <ol className="relative space-y-4 border-l-2 border-border pl-6">
        {visible.map((entry) => {
          const Icon = TYPE_ICON[entry.type] ?? FileText;
          return (
            <li key={entry.id} className="relative">
              <span className={cn("absolute -left-[37px] flex size-8 items-center justify-center rounded-full border-4 border-background", entry.type === "LAB_REPORT" ? "bg-info text-white" : "bg-primary text-primary-foreground")}>
                <Icon className="size-4" aria-hidden />
              </span>
              <Card>
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{t(`record.type.${entry.type}` as MessageKey)}</Badge>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="size-3.5" aria-hidden /> {formatDate(new Date(entry.recordDate), prefs.lang, "long")}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold">{entry.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {[entry.doctorName, entry.facility].filter(Boolean).join(" · ") || t("record.noDetails")}
                    </p>
                    <p className="text-sm">
                      {entry.labCount > 0 ? t("record.resultsExtracted", { count: entry.labCount }) : null}
                      {entry.labCount > 0 && entry.medicineCount > 0 ? " · " : null}
                      {entry.medicineCount > 0 ? t("record.medicinesDetected", { count: entry.medicineCount }) : null}
                    </p>
                  </div>
                  <Link href={`/records/${entry.id}`} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-input bg-card px-4 text-sm font-semibold hover:bg-accent">
                    {t("common.viewDetails")}
                  </Link>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
