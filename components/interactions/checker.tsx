"use client";

import * as React from "react";
import { AlertTriangle, FlaskConical, Plus, ShieldCheck, X } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import type { InteractionFinding } from "@/lib/interactions/types";
import { checkInteractionsAction } from "@/lib/actions/assistant";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/form";

/** Mock interaction check. It reports pairs that may need review. It never advises stopping or changing a medicine. */
export function InteractionChecker({ medicineNames }: { medicineNames: string[] }) {
  const { t } = usePrefs();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [extra, setExtra] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState("");
  const [findings, setFindings] = React.useState<InteractionFinding[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const options = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const name of [...medicineNames, ...extra]) {
      const key = name.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, name.trim());
    }
    return [...seen.values()];
  }, [medicineNames, extra]);

  function toggle(name: string) {
    setFindings(null);
    setSelected((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  function addOther() {
    const name = draft.trim();
    if (!name) return;
    if (!extra.some((item) => item.toLowerCase() === name.toLowerCase())) setExtra((current) => [...current, name]);
    if (!selected.some((item) => item.toLowerCase() === name.toLowerCase())) setSelected((current) => [...current, name]);
    setDraft("");
  }

  function loadExample() {
    setFindings(null);
    setError(null);
    const example = ["Amoxicillin", "Warfarin"];
    setExtra((current) => [...current, ...example.filter((item) => !current.some((existing) => existing.toLowerCase() === item.toLowerCase()) && !medicineNames.some((m) => m.toLowerCase() === item.toLowerCase()))]);
    setSelected(example);
  }

  function check() {
    setError(null);
    if (selected.length < 2) {
      setError(t("interactions.needTwo"));
      return;
    }
    startTransition(async () => {
      const result = await checkInteractionsAction(selected);
      if (!result.ok) {
        setError(t(result.errorKey as MessageKey));
        return;
      }
      setFindings(result.data);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t("interactions.select")}</CardTitle>
          <CardDescription>{t("interactions.mockNotice")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {options.length === 0 ? <p className="text-sm text-muted-foreground">{t("interactions.noMedicines")}</p> : null}
          <fieldset className="space-y-2">
            <legend className="sr-only">{t("interactions.select")}</legend>
            {options.map((name) => (
              <label key={name} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 hover:bg-accent">
                <input
                  type="checkbox"
                  className="size-5 accent-[hsl(var(--primary))]"
                  checked={selected.includes(name)}
                  onChange={() => toggle(name)}
                />
                <span className="font-medium">{name}</span>
                {extra.includes(name) && !medicineNames.includes(name) ? <Badge variant="outline">{t("interactions.mockBadge")}</Badge> : null}
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="other-medicine">{t("interactions.addOther")}</Label>
            <div className="flex gap-2">
              <Input
                id="other-medicine"
                value={draft}
                maxLength={120}
                placeholder={t("interactions.addPlaceholder")}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addOther();
                  }
                }}
              />
              <Button variant="secondary" onClick={addOther} aria-label={t("interactions.add")}>
                <Plus aria-hidden /> {t("interactions.add")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={check} disabled={pending} size="lg">
              <ShieldCheck aria-hidden /> {pending ? t("interactions.checking") : t("interactions.check")}
            </Button>
            <Button variant="outline" onClick={loadExample}>
              <FlaskConical aria-hidden /> {t("interactions.example")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("interactions.exampleHelp")}</p>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((name) => (
                <Badge key={name} variant="neutral" className="gap-1">
                  {name}
                  <button type="button" aria-label={`${t("interactions.remove")}: ${name}`} onClick={() => toggle(name)} className="rounded-full p-0.5 hover:bg-background">
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section aria-live="polite" aria-labelledby="results-title" className="space-y-4">
        <h2 id="results-title" className="text-xl font-bold">{t("interactions.resultTitle")}</h2>
        {pending ? <p role="status" className="text-sm text-muted-foreground">{t("loading.interactions")}</p> : null}
        {error ? <Alert variant="attention" role="alert">{error}</Alert> : null}
        {findings && findings.length === 0 ? <Alert variant="success">{t("interactions.none")}</Alert> : null}
        {findings?.map((finding) => (
          <Alert key={`${finding.medicineA}-${finding.medicineB}`} variant="attention" role="alert" className="block space-y-3">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="size-5 text-attention" aria-hidden />
              {t("interactions.alertTitle")}
            </div>
            <p className="font-semibold">{t("interactions.pair", { a: finding.medicineA, b: finding.medicineB })}</p>
            <p>{t("interactions.alertBody")}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold">{t("interactions.severity")}</dt>
                <dd>{t("interactions.severityValue")}</dd>
              </div>
              <div>
                <dt className="font-semibold">{t("interactions.action")}</dt>
                <dd>{t("interactions.actionValue")}</dd>
              </div>
            </dl>
            <p className="text-sm">{finding.description}</p>
            <p className="text-xs text-muted-foreground">
              {t("interactions.mockBadge")} · {finding.source}
            </p>
          </Alert>
        ))}
        {!findings && !error && !pending ? <p className="text-sm text-muted-foreground">{t("gloss.interaction")}</p> : null}
      </section>
    </div>
  );
}
