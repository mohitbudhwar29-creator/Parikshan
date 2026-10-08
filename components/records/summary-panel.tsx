"use client";

import * as React from "react";
import { Sparkles, RefreshCw, ShieldAlert, CheckCircle2, MessageSquareText, BookOpen, Info } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import type { HealthSummary } from "@/types/health";
import { generateSummaryAction } from "@/lib/actions/records";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

/** On-demand plain-language summary for one saved record. Generated only when the user asks. */
export function SummaryPanel({ recordId, initial }: { recordId: string; initial: HealthSummary | null }) {
  const { t, prefs } = usePrefs();
  const [summary, setSummary] = React.useState<HealthSummary | null>(
    initial && initial.locale === prefs.lang ? initial : null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setSummary(initial && initial.locale === prefs.lang ? initial : null);
  }, [initial, prefs.lang]);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateSummaryAction(recordId);
      if (result.ok) setSummary(result.data);
      else setError(t(result.errorKey as MessageKey));
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden /> {t("summary.title")}
          </CardTitle>
          <CardDescription>{t("summary.placeholder")}</CardDescription>
        </div>
        {summary ? (
          <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
            <RefreshCw aria-hidden /> {t("summary.regenerate")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {pending ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-4 animate-pulse" aria-hidden /> {t("summary.generating")}
          </p>
        ) : null}
        {error ? (
          <Alert variant="attention" role="alert">
            <Info className="size-5 shrink-0" aria-hidden /> {error}
          </Alert>
        ) : null}
        {!summary && !pending ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{t("summary.placeholder")}</p>
            <Button onClick={generate} size="lg">
              <Sparkles aria-hidden /> {t("summary.generate")}
            </Button>
          </div>
        ) : null}
        {summary ? (
          <div className="space-y-5" aria-live="polite">
            <p className="text-base font-medium">{summary.recordCountLine}</p>
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-5 text-success" aria-hidden /> {t("summary.whatNormal")}
              </h3>
              <p className="text-sm">{summary.normalLine}</p>
              {summary.normalItems.length > 0 ? (
                <ul className="list-disc space-y-1 pl-6 text-sm">
                  {summary.normalItems.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="size-5 text-attention" aria-hidden /> {t("summary.whatAttention")}
              </h3>
              {summary.attentionItems.length > 0 ? (
                <ul className="space-y-2">
                  {summary.attentionItems.map((item) => (
                    <li key={item} className="rounded-xl border border-attention/30 bg-attention-soft p-3 text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">{t("summary.noAttention")}</p>
              )}
            </section>
            {summary.terms.length > 0 ? (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 font-semibold">
                  <BookOpen className="size-5 text-info" aria-hidden /> {t("summary.terms")}
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {summary.terms.map((item) => (
                    <div key={item.term} className="rounded-xl bg-muted p-3">
                      <dt className="font-semibold">{item.term}</dt>
                      <dd className="text-sm">{item.explanation}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <MessageSquareText className="size-5 text-primary" aria-hidden /> {t("summary.discuss")}
              </h3>
              <ul className="list-disc space-y-1 pl-6 text-sm">
                {summary.discussItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <Alert variant="info">
              <Info className="size-5 shrink-0" aria-hidden /> {summary.caution}
            </Alert>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
