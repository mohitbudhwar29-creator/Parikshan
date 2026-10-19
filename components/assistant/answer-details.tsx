import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { Translator } from "@/lib/i18n";
import { localeTag, type Locale } from "@/lib/i18n";
import type { VoiceAnswer, VoiceCitation } from "@/lib/voice/types";
import { Alert } from "@/components/ui/alert";

function formatReportDate(value: string, locale: Locale): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function citationLines(citation: VoiceCitation, t: Translator, locale: Locale) {
  const report = citation.reportTitle;
  const date = formatReportDate(citation.reportDate, locale);
  const headline =
    citation.testName && citation.value !== null
      ? t("voice.citation.value", { test: citation.testName, value: citation.value, unit: citation.unit ?? "" }).trim()
      : t("voice.citation.noValue", { report });
  return {
    headline,
    meta: t("voice.citation.meta", { report, date }),
    range: citation.referenceRange ? t("voice.citation.range", { range: citation.referenceRange }) : null,
    outside: citation.flag === "LOW" || citation.flag === "HIGH" ? t("common.outsideRange") : null,
  };
}

/** Citations, limitations and notices for one answer. Every value is shown exactly as stored. */
export function AnswerDetails({ answer, t, locale }: { answer: VoiceAnswer; t: Translator; locale: Locale }) {
  return (
    <div className="space-y-3">
      {answer.citations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("voice.sources")}</p>
          <ul className="flex flex-col gap-2">
            {answer.citations.map((citation, index) => {
              const lines = citationLines(citation, t, locale);
              return (
                <li key={`${citation.recordId}-${citation.testName ?? "report"}-${index}`}>
                  <Link
                    href={`/records/${citation.recordId}`}
                    className="block rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="block font-semibold text-primary">{lines.headline}</span>
                    <span className="block text-xs text-muted-foreground">{lines.meta}</span>
                    {lines.range ? <span className="block text-xs text-muted-foreground">{lines.range}</span> : null}
                    {lines.outside ? <span className="block text-xs font-semibold">{lines.outside}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {answer.limitations.length > 0 ? (
        <Alert variant="warning" className="space-y-1">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <ul className="space-y-1">
            {answer.limitations.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("voice.aiNotice")}</span>
      </p>
    </div>
  );
}
