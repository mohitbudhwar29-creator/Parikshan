"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
import { addMedicationAction, type MedicationFormState } from "@/lib/actions/medications";
import { frequencyLabelKey } from "@/lib/health/medication-schedule";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";

export function AddMedicationForm({ today }: { today: string }) {
  const { t } = usePrefs();
  const [state, formAction, pending] = useActionState<MedicationFormState | null, FormData>(addMedicationAction, null);
  const errors = state?.fieldErrors ?? {};
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (state?.saved) setSaved(true);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("meds.addTitle")}</CardTitle>
        <CardDescription>{t("meds.addHelp")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 md:grid-cols-2" noValidate onChange={() => setSaved(false)}>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="med-name">{t("meds.name")}</Label>
            <Input id="med-name" name="name" required aria-invalid={Boolean(errors.name)} aria-describedby="med-name-error" />
            <FieldError id="med-name-error" message={errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="med-dosage">{t("meds.dosage")}</Label>
            <Input id="med-dosage" name="dosage" placeholder="500 mg" required aria-invalid={Boolean(errors.dosage)} aria-describedby="med-dosage-error" />
            <FieldError id="med-dosage-error" message={errors.dosage} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="med-frequency">{t("meds.frequency")}</Label>
            <Select id="med-frequency" name="timesPerDay" defaultValue="1">
              {[1, 2, 3, 0].map((count) => (
                <option key={count} value={count}>{t(frequencyLabelKey(count))}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="med-start">{t("meds.startDate")}</Label>
            <Input id="med-start" name="startDate" type="date" defaultValue={today} required aria-invalid={Boolean(errors.startDate)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="med-end">
              {t("meds.endDate")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Input id="med-end" name="endDate" type="date" aria-invalid={Boolean(errors.endDate)} aria-describedby="med-end-error" />
            <FieldError id="med-end-error" message={errors.endDate} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="med-notes">
              {t("meds.notes")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Textarea id="med-notes" name="notes" rows={2} maxLength={300} />
          </div>
          {state?.errorKey ? (
            <div className="md:col-span-2">
              <Alert variant="attention" role="alert">{t(state.errorKey)}</Alert>
            </div>
          ) : null}
          {saved ? (
            <div className="md:col-span-2">
              <Alert variant="success" role="status">{t("meds.saved")}</Alert>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending}>
              <Plus aria-hidden /> {t("meds.add")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
