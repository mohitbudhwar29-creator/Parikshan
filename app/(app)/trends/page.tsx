import type { Metadata } from "next";
import { requireAppContext } from "@/lib/auth/context";
import { getMetricSeries } from "@/lib/database/metrics";
import { createTranslator } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/en";
import { buildTrendPanel } from "@/lib/trends/data";
import { PageHeader } from "@/components/ui/page";
import { TrendsView } from "@/components/trends/trends-view";

export const metadata: Metadata = { title: "Health Trends" };

export default async function TrendsPage() {
  const { profile, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const series = await getMetricSeries(profile.id);
  const dateLabel = (iso: string) => formatDate(new Date(iso), prefs.lang, "short");
  const sourceLabel = (type: string | null) => (type ? t(`record.type.${type}` as MessageKey) : "—");
  const metricLabel = (key: string) => (prefs.easyRead ? t(`metric.${key}.easy` as MessageKey) : t(`metric.${key}` as MessageKey));

  const panels = [
    buildTrendPanel({ key: "hemoglobin", label: metricLabel("hemoglobin"), primary: "hemoglobin", series, formatDateLabel: dateLabel, sourceLabel }),
    buildTrendPanel({ key: "blood_glucose", label: metricLabel("blood_glucose"), primary: "blood_glucose", series, formatDateLabel: dateLabel, sourceLabel }),
    buildTrendPanel({
      key: "blood_pressure",
      label: metricLabel("blood_pressure"),
      primary: "blood_pressure_systolic",
      secondary: "blood_pressure_diastolic",
      series,
      formatDateLabel: dateLabel,
      sourceLabel,
    }),
    buildTrendPanel({ key: "heart_rate", label: metricLabel("heart_rate"), primary: "heart_rate", series, formatDateLabel: dateLabel, sourceLabel }),
    buildTrendPanel({ key: "weight", label: metricLabel("weight"), primary: "weight", series, formatDateLabel: dateLabel, sourceLabel }),
    buildTrendPanel({ key: "vitamin_d", label: metricLabel("vitamin_d"), primary: "vitamin_d", series, formatDateLabel: dateLabel, sourceLabel }),
    buildTrendPanel({ key: "cholesterol_total", label: metricLabel("cholesterol_total"), primary: "cholesterol_total", series, formatDateLabel: dateLabel, sourceLabel }),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("trends.title")} subtitle={t("trends.subtitle")} />
      <TrendsView panels={panels} />
    </div>
  );
}
