"use client";

import * as React from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { formatChangeFor, formatMetricValue } from "@/lib/health/trends";
import type { MetricName } from "@/types/health";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { FlagPill } from "@/components/dashboard/metric-card";
import type { TrendPanelData, TrendReading } from "@/lib/trends/data";
import { cn } from "@/lib/utils";

export function TrendsView({ panels }: { panels: TrendPanelData[] }) {
  const { t } = usePrefs();
  const firstWithData = panels.find((panel) => panel.chart.length > 0)?.key ?? panels[0]?.key ?? "";
  const [selected, setSelected] = React.useState(firstWithData);
  const panel = panels.find((item) => item.key === selected) ?? panels[0];

  if (!panel) return null;

  const flagLabels = {
    high: t("record.values.high"),
    low: t("record.values.low"),
    normal: t("record.values.normal"),
    unknown: t("record.values.unknown"),
  };
  const summary = panel.summary;
  const metricName = (summary?.metric ?? "hemoglobin") as MetricName;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={t("trends.select")} className="flex flex-wrap gap-2">
        {panels.map((item) => (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={item.key === panel.key}
            onClick={() => setSelected(item.key)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
              item.key === panel.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
            )}
          >
            {item.label}
            {item.chart.length === 0 ? <span className="ml-2 text-xs opacity-70">—</span> : null}
          </button>
        ))}
      </div>

      {panel.chart.length === 0 || !summary ? (
        <Alert variant="info">
          <Info className="size-5 shrink-0" aria-hidden /> {t("trends.noData")}
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardDescription>{t("trends.latest")}</CardDescription>
                <CardTitle className="text-4xl">
                  {panel.isBloodPressure && panel.diastolicSummary
                    ? `${formatMetricValue(metricName, summary.latest.value)}/${formatMetricValue("blood_pressure_diastolic", panel.diastolicSummary.latest.value)}`
                    : formatMetricValue(metricName, summary.latest.value)}
                  <span className="ml-2 text-base font-medium text-muted-foreground">{panel.displayUnit}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FlagPill flag={summary.flag} labels={flagLabels} />
                {panel.referenceText ? (
                  <p className="text-sm text-muted-foreground">
                    {t("trends.reference")}: <span className="font-semibold text-foreground">{panel.referenceText}</span>
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">{t("trends.points", { count: summary.readingCount })}</p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                <ChangeBlock
                  title={t("trends.compared")}
                  change={summary.changeFromPrevious}
                  metric={metricName}
                  unit={panel.displayUnit}
                  from={summary.previous ? formatMetricValue(metricName, summary.previous.value) : null}
                  to={formatMetricValue(metricName, summary.latest.value)}
                  noChangeLabel={t("trends.noChange")}
                  noDataLabel={t("common.noDataYet")}
                  arrowLabel={t("trends.source")}
                />
                <ChangeBlock
                  title={t("trends.sinceFirst")}
                  change={summary.changeSinceFirst}
                  metric={metricName}
                  unit={panel.displayUnit}
                  from={summary.first ? formatMetricValue(metricName, summary.first.value) : null}
                  to={formatMetricValue(metricName, summary.latest.value)}
                  noChangeLabel={t("trends.noChange")}
                  noDataLabel={t("common.noDataYet")}
                  arrowLabel={t("trends.source")}
                />
                {panel.isBloodPressure ? (
                  <p className="text-sm text-muted-foreground sm:col-span-2">{t("trends.bpNote")}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{panel.label}</CardTitle>
              <CardDescription>{t("trends.chartLabel", { name: panel.label })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="img" aria-label={t("trends.chartLabel", { name: panel.label })} className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={panel.chart} margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 13 }} width={48} />
                    <Tooltip
                      formatter={(value) => (typeof value === "number" ? formatMetricValue(metricName, value) : String(value))}
                      contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border))" }}
                    />
                    {panel.chart.length > 0 && panel.chart[0]?.low !== null && panel.chart[0]?.high !== null ? (
                      <ReferenceArea y1={panel.chart[0]!.low!} y2={panel.chart[0]!.high!} fill="hsl(var(--success))" fillOpacity={0.12} label={{ value: t("trends.reference"), position: "insideTopLeft", fontSize: 12 }} />
                    ) : null}
                    {panel.chart[0]?.high !== null && panel.chart[0]?.low === null ? <ReferenceLine y={panel.chart[0]!.high!} stroke="hsl(var(--attention))" strokeDasharray="4 4" /> : null}
                    <Line type="monotone" dataKey="value" name={panel.label} stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                    {panel.isBloodPressure ? (
                      <Line type="monotone" dataKey="diastolic" name={t("metric.blood_pressure_diastolic")} stroke="hsl(var(--info))" strokeWidth={3} dot={{ r: 5 }} />
                    ) : null}
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("trends.discuss")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("trends.readings")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-semibold">{t("record.date")}</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">{panel.label}</th>
                    <th scope="col" className="py-2 font-semibold">{t("trends.source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {panel.readings.map((reading: TrendReading) => (
                    <tr key={`${reading.date}-${reading.value}`} className="border-b border-border/60">
                      <td className="py-2 pr-4">{reading.date}</td>
                      <td className="py-2 pr-4 font-semibold">
                        {reading.diastolic ? `${reading.value}/${reading.diastolic}` : reading.value} {panel.displayUnit}
                      </td>
                      <td className="py-2 text-muted-foreground">{reading.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ChangeBlock({
  title,
  change,
  metric,
  unit,
  from,
  to,
  noChangeLabel,
  noDataLabel,
  arrowLabel,
}: {
  title: string;
  change: number | null;
  metric: MetricName;
  unit: string;
  from: string | null;
  to: string;
  noChangeLabel: string;
  noDataLabel: string;
  arrowLabel: string;
}) {
  const up = change !== null && change > 0;
  const down = change !== null && change < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : ArrowRight;
  return (
    <div className="space-y-2 rounded-xl bg-muted p-4">
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      {change === null || from === null ? (
        <p className="text-sm">{noDataLabel}</p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-2xl font-bold">
            <Icon className="size-5 text-primary" aria-hidden />
            {formatChangeFor(metric, change)} <span className="text-sm font-medium text-muted-foreground">{unit}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {arrowLabel}: {from} → {to} {unit}
          </p>
          <Badge variant="outline">{change === 0 ? noChangeLabel : up ? "↑" : "↓"}</Badge>
        </>
      )}
    </div>
  );
}

