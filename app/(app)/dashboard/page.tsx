import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Droplets, HeartPulse, Pill, FlaskConical, Sparkles, Stethoscope, ArrowRight, Info, Upload, History, Route } from "lucide-react";
import { requireAppContext } from "@/lib/auth/context";
import { getMetricSeries } from "@/lib/database/metrics";
import { listMedicationsForProfile } from "@/lib/database/medications";
import { listSavedRecords } from "@/lib/database/records";
import { createTranslator, type Locale, type Translator } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { summarizeTrend, formatMetricValue, formatChangeFor, type TrendSummary } from "@/lib/health/trends";
import { toMedicineCard } from "@/lib/medications/view";
import type { MessageKey } from "@/lib/i18n/en";
import type { MetricName } from "@/types/health";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, FlagPill } from "@/components/dashboard/metric-card";
import { DoseToggles } from "@/components/medications/dose-toggles";

export const metadata: Metadata = { title: "Dashboard" };

const INSIGHT_METRICS: MetricName[] = ["hemoglobin", "blood_glucose", "vitamin_d", "cholesterol_total", "heart_rate", "weight"];

function greetingKey(hour: number): MessageKey {
  if (hour < 12) return "dashboard.greeting.morning";
  if (hour < 17) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

function flagLabels(t: Translator) {
  return { high: t("record.values.high"), low: t("record.values.low"), normal: t("record.values.normal"), unknown: t("record.values.unknown") };
}

/** One line per trend: "compared with previous" and "since first report". */
function trendLines(summary: TrendSummary, metric: MetricName, t: Translator, locale: Locale, unit: string): string[] {
  const lines: string[] = [];
  if (summary.changeFromPrevious !== null) {
    lines.push(`${t("trends.compared")}: ${formatChangeFor(metric, summary.changeFromPrevious)} ${unit}`);
  }
  if (summary.first && summary.changeSinceFirst !== null) {
    lines.push(
      t("dashboard.card.sinceFirst", {
        date: formatDate(new Date(summary.first.date), locale, "short"),
        from: formatMetricValue(metric, summary.first.value),
        to: formatMetricValue(metric, summary.latest.value),
      }),
    );
  }
  return lines;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  const { user, profile, prefs } = await requireAppContext();
  const locale = prefs.lang;
  const t = createTranslator(locale);
  const params = await searchParams;
  const today = new Date();

  const [series, medicines, recent] = await Promise.all([
    getMetricSeries(profile.id),
    listMedicationsForProfile(profile.id, today),
    listSavedRecords(profile.id, 3),
  ]);

  const hb = summarizeTrend("hemoglobin", series.hemoglobin);
  const glucose = summarizeTrend("blood_glucose", series.blood_glucose);
  const bpSys = summarizeTrend("blood_pressure_systolic", series.blood_pressure_systolic);
  const bpDia = summarizeTrend("blood_pressure_diastolic", series.blood_pressure_diastolic);

  const cards = medicines.map((row) => toMedicineCard(row, today));
  const active = cards.filter((card) => card.status === "ACTIVE");
  const dosesTotal = active.reduce((sum, card) => sum + card.scheduledSlots.length, 0);
  const dosesTaken = active.reduce((sum, card) => sum + card.takenSlots.length, 0);

  // Insights: changes between the latest reading and the one before it.
  const insights: string[] = [];
  if (hb?.changeFromPrevious) {
    insights.push(t("dashboard.insights.metric", { name: t("metric.hemoglobin"), from: formatMetricValue("hemoglobin", hb.previous!.value), to: formatMetricValue("hemoglobin", hb.latest.value), unit: hb.latest.unit }));
  }
  if (glucose?.changeFromPrevious) {
    insights.push(t("dashboard.insights.metric", { name: t("metric.blood_glucose"), from: formatMetricValue("blood_glucose", glucose.previous!.value), to: formatMetricValue("blood_glucose", glucose.latest.value), unit: glucose.latest.unit }));
  }
  if ((bpSys?.changeFromPrevious ?? 0) !== 0 || (bpDia?.changeFromPrevious ?? 0) !== 0) {
    if (bpSys?.previous && bpDia?.previous && bpSys.latest && bpDia.latest) {
      insights.push(t("dashboard.insights.bp", { from: `${bpSys.previous.value}/${bpDia.previous.value}`, to: `${bpSys.latest.value}/${bpDia.latest.value}` }));
    }
  }
  for (const metric of INSIGHT_METRICS) {
    if (metric === "hemoglobin" || metric === "blood_glucose") continue;
    const summary = summarizeTrend(metric, series[metric]);
    if (summary?.changeFromPrevious) {
      insights.push(t("dashboard.insights.metric", { name: t(`metric.${metric}` as MessageKey), from: formatMetricValue(metric, summary.previous!.value), to: formatMetricValue(metric, summary.latest.value), unit: summary.latest.unit }));
    }
  }

  const hour = new Date().getUTCHours();
  const hasRecords = recent.length > 0 || cards.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t(greetingKey(hour), { name: user.name.split(" ")[0] ?? user.name })}
        subtitle={t("dashboard.subtitle")}
        actions={
          <>
            <Link href="/upload"><Button><Upload aria-hidden /> {t("dashboard.upload")}</Button></Link>
            <Link href="/caregiver"><Button variant="outline"><HeartPulse aria-hidden /> {t("dashboard.caregiver")}</Button></Link>
          </>
        }
      />

      {params.tour === "1" ? (
        <Card className="border-primary/40 bg-accent/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Route className="size-5 text-primary" aria-hidden /> {t("dashboard.tour.title")}</CardTitle>
            <CardDescription>{t("dashboard.tour.body")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 md:grid-cols-2">
              {[
                { href: "/upload", label: t("dashboard.tour.step1") },
                { href: "/trends", label: t("dashboard.tour.step2") },
                { href: "/assistant", label: t("dashboard.tour.step3") },
                { href: "/interactions", label: t("dashboard.tour.step4") },
                { href: "/family", label: t("dashboard.tour.step5") },
              ].map((step, index) => (
                <li key={step.href}>
                  <Link href={step.href} className="flex items-center gap-3 rounded-xl bg-card p-3 font-medium hover:bg-muted">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                    <span className="flex-1">{step.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {profile.relationship === "CHILD" ? (
        <Alert variant="info"><Info className="size-5 shrink-0" aria-hidden /> {t("dashboard.childNote")}</Alert>
      ) : null}

      {!hasRecords ? (
        <EmptyState
          icon={<History className="size-6" aria-hidden />}
          title={t("dashboard.empty.title")}
          body={t("dashboard.empty.body")}
          action={<Link href="/upload"><Button>{t("dashboard.upload")}</Button></Link>}
        />
      ) : null}

      <section aria-labelledby="overview" className="space-y-4">
        <h2 id="overview" className="text-xl font-bold">{t("dashboard.overview")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Droplets className="size-4" aria-hidden />}
            label={t("dashboard.card.hemoglobin")}
            value={hb ? formatMetricValue("hemoglobin", hb.latest.value) : "—"}
            unit={hb?.latest.unit}
            flagBadge={hb ? <FlagPill flag={hb.flag} labels={flagLabels(t)} /> : null}
            lines={hb ? trendLines(hb, "hemoglobin", t, locale, hb.latest.unit) : [t("dashboard.card.noReading")]}
            tone={hb?.flag === "LOW" || hb?.flag === "HIGH" ? "attention" : "default"}
          />
          <MetricCard
            icon={<Activity className="size-4" aria-hidden />}
            label={t("dashboard.card.bloodPressure")}
            value={bpSys && bpDia ? `${bpSys.latest.value}/${bpDia.latest.value}` : "—"}
            unit={bpSys ? "mmHg" : undefined}
            flagBadge={bpSys ? <FlagPill flag={bpSys.flag} labels={flagLabels(t)} /> : null}
            lines={
              bpSys && bpDia && bpSys.previous && bpDia.previous
                ? [
                    `${t("trends.compared")}: ${bpSys.previous.value}/${bpDia.previous.value} → ${bpSys.latest.value}/${bpDia.latest.value}`,
                  ]
                : [t("dashboard.card.noReading")]
            }
          />
          <MetricCard
            icon={<FlaskConical className="size-4" aria-hidden />}
            label={t("dashboard.card.glucose")}
            value={glucose ? formatMetricValue("blood_glucose", glucose.latest.value) : "—"}
            unit={glucose?.latest.unit}
            flagBadge={glucose ? <FlagPill flag={glucose.flag} labels={flagLabels(t)} /> : null}
            lines={glucose ? trendLines(glucose, "blood_glucose", t, locale, glucose.latest.unit) : [t("dashboard.card.noReading")]}
          />
          <MetricCard
            icon={<Pill className="size-4" aria-hidden />}
            label={t("dashboard.card.medicines")}
            value={String(active.length)}
            lines={[active.length > 0 ? t("meds.doseCount", { taken: dosesTaken, total: dosesTotal }) : t("dashboard.card.medicinesNone")]}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" aria-hidden /> {t("dashboard.insights.title")}</CardTitle>
            <CardDescription>{insights.length > 0 ? t("dashboard.insights.subtitle", { count: insights.length }) : t("dashboard.insights.none")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((line) => (
              <p key={line} className="rounded-xl bg-muted p-3 text-sm">{line}</p>
            ))}
            <p className="text-xs text-muted-foreground">{t("dashboard.insights.note")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.schedule.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {active.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboard.schedule.none")}</p> : null}
            {active.map((card) => (
              <div key={card.id} className="space-y-2">
                <p className="font-semibold">{card.name} <span className="font-normal text-muted-foreground">{card.dosage}</span></p>
                <DoseToggles medicationId={card.id} medicineName={card.name} scheduledSlots={card.scheduledSlots} takenSlots={card.takenSlots} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("dashboard.records.title")}</CardTitle>
          <Link href="/timeline" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">{t("dashboard.records.viewAll")}</Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboard.empty.body")}</p> : null}
          <ul className="divide-y divide-border">
            {recent.map((record) => (
              <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Stethoscope className="size-4" aria-hidden /></span>
                  <div>
                    <p className="font-semibold">{record.title}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(record.recordDate, locale, "short")} · {t(`record.type.${record.type}` as MessageKey)}</p>
                  </div>
                </div>
                <Link href={`/records/${record.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-primary hover:bg-accent">
                  {t("common.viewDetails")}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
