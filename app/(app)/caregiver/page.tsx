import type { Metadata } from "next";
import Link from "next/link";
import { Baby, CalendarClock, ClipboardList, HeartPulse, History, Pill, TrendingUp, Upload } from "lucide-react";
import { requireAppContext } from "@/lib/auth/context";
import { getMetricSeries } from "@/lib/database/metrics";
import { listMedicationsForProfile } from "@/lib/database/medications";
import { listSavedRecords } from "@/lib/database/records";
import { createTranslator } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/en";
import { formatMetricValue, summarizeTrend } from "@/lib/health/trends";
import { slotLabelKey, slotTimeKey } from "@/lib/health/medication-schedule";
import { toMedicineCard } from "@/lib/medications/view";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlagPill } from "@/components/dashboard/metric-card";
import type { MetricName } from "@/types/health";

export const metadata: Metadata = { title: "Caregiver View" };

export default async function CaregiverPage() {
  const { profile, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const today = new Date();
  const [series, medicines, records] = await Promise.all([
    getMetricSeries(profile.id),
    listMedicationsForProfile(profile.id, today),
    listSavedRecords(profile.id, 3),
  ]);

  const activeMedicines = medicines
    .map((row) => toMedicineCard(row, today))
    .filter((card) => card.status === "ACTIVE" && card.scheduledSlots.length > 0);

  const flagLabels = {
    high: t("record.values.high"),
    low: t("record.values.low"),
    normal: t("record.values.normal"),
    unknown: t("record.values.unknown"),
  };

  const trendMetrics: { metric: MetricName; key: MessageKey }[] = [
    { metric: "hemoglobin", key: "metric.hemoglobin" },
    { metric: "blood_glucose", key: "metric.blood_glucose" },
    { metric: "blood_pressure_systolic", key: "metric.blood_pressure" },
    { metric: "heart_rate", key: "metric.heart_rate" },
    { metric: "weight", key: "metric.weight" },
  ];
  const trends = trendMetrics
    .map((item) => ({ ...item, summary: summarizeTrend(item.metric, series[item.metric]) }))
    .filter((item) => item.summary !== null && (item.summary.readingCount >= 2 || item.summary.flag === "LOW" || item.summary.flag === "HIGH"));

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("caregiver.title")}
        subtitle={`${t("caregiver.subtitle")} — ${profile.name}`}
        actions={
          <>
            <Link href="/upload"><Button><Upload aria-hidden /> {t("caregiver.upload")}</Button></Link>
            <Link href="/timeline"><Button variant="outline"><History aria-hidden /> {t("caregiver.allTimeline")}</Button></Link>
          </>
        }
      />

      {profile.relationship === "CHILD" ? (
        <Alert variant="info"><Baby className="size-5 shrink-0" aria-hidden /> {t("caregiver.childNote")}</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="size-5 text-primary" aria-hidden /> {t("caregiver.upcoming")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeMedicines.length === 0 ? <p className="text-sm text-muted-foreground">{t("caregiver.noUpcoming")}</p> : null}
            <ul className="space-y-3">
              {activeMedicines.map((card) => {
                const nextSlot = card.scheduledSlots.find((slot) => !card.takenSlots.includes(slot));
                return (
                  <li key={card.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-4">
                    <div>
                      <p className="flex items-center gap-2 font-semibold"><Pill className="size-4 text-primary" aria-hidden /> {card.name}</p>
                      <p className="text-sm text-muted-foreground">{card.dosage}</p>
                    </div>
                    {nextSlot ? (
                      <Badge variant="info">{t("caregiver.nextDose", { time: `${t(slotLabelKey(nextSlot))} ${t(slotTimeKey(nextSlot) as MessageKey)}` })}</Badge>
                    ) : (
                      <Badge variant="success">{t("meds.taken")}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="size-5 text-primary" aria-hidden /> {t("caregiver.trends")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trends.length === 0 ? <p className="text-sm text-muted-foreground">{t("caregiver.noTrends")}</p> : null}
            {trends.map((item) => (
              <div key={item.metric} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-4">
                <div>
                  <p className="font-semibold">{t(item.key)}</p>
                  <p className="text-2xl font-bold">
                    {formatMetricValue(item.metric, item.summary!.latest.value)} <span className="text-sm font-medium text-muted-foreground">{item.summary!.latest.unit}</span>
                  </p>
                </div>
                <FlagPill flag={item.summary!.flag} labels={flagLabels} />
              </div>
            ))}
            <Link href="/trends" className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">{t("nav.trends")}</Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ClipboardList className="size-5 text-primary" aria-hidden /> {t("caregiver.reports")}</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? <p className="text-sm text-muted-foreground">{t("caregiver.noReports")}</p> : null}
          <ul className="divide-y divide-border">
            {records.map((record) => (
              <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{record.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(record.recordDate, prefs.lang, "short")} · {t(`record.type.${record.type}` as MessageKey)}
                  </p>
                </div>
                <Link href={`/records/${record.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-primary hover:bg-accent">
                  {t("common.viewDetails")}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <HeartPulse className="size-4 text-primary" aria-hidden /> {t("disclaimer.full")}
      </p>
    </div>
  );
}
