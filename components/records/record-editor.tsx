"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus, Trash2, Check, Save, ShieldQuestion, X } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import { DOCUMENT_TYPES, extractedRecordSchema, type ExtractedRecord, type ExtractedMedicine, type ExtractedLabValue } from "@/types/health";
import { frequencyLabelKey } from "@/lib/health/medication-schedule";
import { confirmRecordAction } from "@/lib/actions/records";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/form";
import { flagForLabValue, type RecordView } from "@/lib/records/view";
import { cn } from "@/lib/utils";

type Draft = ExtractedRecord;

/** One value with its own Edit control. When `forceEdit` is on (after "Looks incorrect?") every field is open. */
function EditableField({
  label,
  value,
  forceEdit,
  onChange,
  type = "text",
  inputMode,
  children,
  editLabel,
  doneLabel,
}: {
  label: string;
  value: string;
  forceEdit: boolean;
  onChange?: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  children?: React.ReactNode;
  editLabel: string;
  doneLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const editing = forceEdit || open;
  const id = React.useId();
  if (editing) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex gap-2">
          {children ?? (
            <Input id={id} type={type} inputMode={inputMode} value={value} onChange={(event) => onChange?.(event.target.value)} />
          )}
          {!forceEdit ? (
            <Button variant="secondary" size="icon" onClick={() => setOpen(false)} aria-label={doneLabel}>
              <Check aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words text-base">{value || "—"}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`${editLabel}: ${label}`}>
        <Pencil aria-hidden /> {editLabel}
      </Button>
    </div>
  );
}

export function RecordEditor({ record }: { record: RecordView }) {
  const { t } = usePrefs();
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft>(record.extracted);
  const [forceEdit, setForceEdit] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const isDraft = record.status === "REVIEW";
  const originalJson = React.useMemo(() => JSON.stringify(record.extracted), [record.extracted]);
  const changed = JSON.stringify(draft) !== originalJson;
  const editLabel = t("common.edit");
  const doneLabel = t("common.done");

  React.useEffect(() => {
    setDraft(record.extracted);
  }, [record.extracted]);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function patchLab(index: number, next: Partial<ExtractedLabValue>) {
    setDraft((current) => ({
      ...current,
      labValues: current.labValues.map((row, i) => (i === index ? { ...row, ...next } : row)),
    }));
  }

  function patchMedicine(index: number, next: Partial<ExtractedMedicine>) {
    setDraft((current) => ({
      ...current,
      medications: current.medications.map((row, i) => (i === index ? { ...row, ...next } : row)),
    }));
  }

  function save() {
    setError(null);
    const parsed = extractedRecordSchema.safeParse(draft);
    if (!parsed.success) {
      setError(t("upload.saveFailed"));
      return;
    }
    startTransition(async () => {
      const result = await confirmRecordAction(record.id, JSON.stringify(parsed.data));
      if (!result.ok) {
        setError(t(result.errorKey as MessageKey));
        return;
      }
      router.push(`/records/${result.data.recordId}?saved=1`);
      router.refresh();
    });
  }

  const labelFor = (type: string) => t(`record.type.${type}` as MessageKey);

  return (
    <div className="space-y-6" data-testid="record-editor">
      {isDraft ? (
        <Alert variant="info" role="status">
          <ShieldQuestion className="size-5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">{t("record.draftBanner")}</p>
            <p>{t("upload.reviewSubtitle")}</p>
          </div>
        </Alert>
      ) : null}

      {draft.warnings.length > 0 ? (
        <Alert variant="warning" role="note">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">{t("upload.warnings")}</p>
            <ul className="list-disc pl-5">
              {record.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">{t("upload.extracted")}</p>
          <p className="text-sm text-muted-foreground">{t("upload.looksIncorrectHelp")}</p>
        </div>
        <Button variant={forceEdit ? "default" : "outline"} onClick={() => setForceEdit((value) => !value)} aria-pressed={forceEdit}>
          <ShieldQuestion aria-hidden /> {forceEdit ? doneLabel : t("upload.looksIncorrect")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("upload.documentInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <EditableField label={t("upload.docType")} value={labelFor(draft.documentType)} forceEdit={forceEdit} editLabel={editLabel} doneLabel={doneLabel}>
            <Select value={draft.documentType} onChange={(event) => patch("documentType", event.target.value as Draft["documentType"])} aria-label={t("upload.docType")}>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{labelFor(type)}</option>
              ))}
            </Select>
          </EditableField>
          <EditableField label={t("upload.title.label")} value={draft.title} forceEdit={forceEdit} onChange={(value) => patch("title", value)} editLabel={editLabel} doneLabel={doneLabel} />
          <EditableField label={t("upload.recordDate")} type="date" value={draft.recordDate} forceEdit={forceEdit} onChange={(value) => patch("recordDate", value)} editLabel={editLabel} doneLabel={doneLabel} />
          <EditableField label={t("upload.doctor")} value={draft.doctorName ?? ""} forceEdit={forceEdit} onChange={(value) => patch("doctorName", value)} editLabel={editLabel} doneLabel={doneLabel} />
          <EditableField label={t("upload.facility")} value={draft.facility ?? ""} forceEdit={forceEdit} onChange={(value) => patch("facility", value)} editLabel={editLabel} doneLabel={doneLabel} />
          <div className="sm:col-span-2">
            <EditableField
              label={t("upload.diagnosis")}
              value={draft.diagnosisTerms.join(", ")}
              forceEdit={forceEdit}
              onChange={(value) => patch("diagnosisTerms", value.split(",").map((term) => term.trim()).filter(Boolean))}
              editLabel={editLabel}
              doneLabel={doneLabel}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("upload.diagnosisHelp")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upload.labValues")}</CardTitle>
          <CardDescription>{t("common.unitNotes")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.labValues.length === 0 ? <p className="text-sm text-muted-foreground">{t("upload.noLabs")}</p> : null}
          {draft.labValues.map((row, index) => {
            const flag = flagForLabValue(row.value, row.referenceRange ?? "");
            return (
              <div key={`lab-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] md:items-start">
                <EditableField label={t("upload.testLabel")} value={row.testName} forceEdit={forceEdit} onChange={(value) => patchLab(index, { testName: value })} editLabel={editLabel} doneLabel={doneLabel} />
                <EditableField label={t("upload.valueLabel")} value={row.value} forceEdit={forceEdit} onChange={(value) => patchLab(index, { value })} editLabel={editLabel} doneLabel={doneLabel} />
                <EditableField label={t("upload.unitLabel")} value={row.unit ?? ""} forceEdit={forceEdit} onChange={(value) => patchLab(index, { unit: value })} editLabel={editLabel} doneLabel={doneLabel} />
                <EditableField label={t("upload.referenceLabel")} value={row.referenceRange ?? ""} forceEdit={forceEdit} onChange={(value) => patchLab(index, { referenceRange: value })} editLabel={editLabel} doneLabel={doneLabel} />
                <div className="flex flex-col gap-2 md:pt-6">
                  <FlagBadge flag={flag} t={t} />
                  {forceEdit ? (
                    <Button variant="ghost" size="sm" onClick={() => patch("labValues", draft.labValues.filter((_, i) => i !== index))}>
                      <X aria-hidden /> {t("upload.removeRow")}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {forceEdit ? (
            <Button variant="outline" onClick={() => patch("labValues", [...draft.labValues, { testName: "", value: "", unit: "", referenceRange: "" }])}>
              <Plus aria-hidden /> {t("upload.addLab")}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upload.medicines")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.medications.length === 0 ? <p className="text-sm text-muted-foreground">{t("upload.noMedicines")}</p> : null}
          {draft.medications.map((row, index) => (
            <div key={`med-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-2">
              <EditableField label={t("upload.medicineName")} value={row.name} forceEdit={forceEdit} onChange={(value) => patchMedicine(index, { name: value })} editLabel={editLabel} doneLabel={doneLabel} />
              <EditableField label={t("upload.dosage")} value={row.dosage} forceEdit={forceEdit} onChange={(value) => patchMedicine(index, { dosage: value })} editLabel={editLabel} doneLabel={doneLabel} />
              <EditableField label={t("upload.frequency")} value={t(frequencyLabelKey(row.timesPerDay))} forceEdit={forceEdit} editLabel={editLabel} doneLabel={doneLabel}>
                <Select value={row.timesPerDay} onChange={(event) => patchMedicine(index, { timesPerDay: Number(event.target.value) })} aria-label={t("upload.frequency")}>
                  {[0, 1, 2, 3].map((count) => (
                    <option key={count} value={count}>{t(frequencyLabelKey(count))}</option>
                  ))}
                </Select>
              </EditableField>
              <EditableField
                label={t("upload.duration")}
                value={row.durationDays ? t("meds.durationDays", { count: row.durationDays }) : t("meds.ongoing")}
                forceEdit={forceEdit}
                onChange={(value) => patchMedicine(index, { durationDays: value === "" ? null : Math.round(Number(value)) })}
                editLabel={editLabel}
                doneLabel={doneLabel}
                type="number"
                inputMode="numeric"
              />
              {forceEdit ? (
                <div className="md:col-span-2">
                  <Button variant="ghost" size="sm" onClick={() => patch("medications", draft.medications.filter((_, i) => i !== index))}>
                    <Trash2 aria-hidden /> {t("upload.removeRow")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {forceEdit ? (
            <Button
              variant="outline"
              onClick={() =>
                patch("medications", [...draft.medications, { name: "", dosage: "", frequency: "", timesPerDay: 1, durationDays: null, notes: "" }])
              }
            >
              <Plus aria-hidden /> {t("upload.addMedicine")}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="attention" role="alert">
          <AlertTriangle className="size-5 shrink-0" aria-hidden /> {error}
        </Alert>
      ) : null}

      <div className={cn("sticky bottom-20 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur md:bottom-4", !isDraft && !changed && "hidden")}>
        <Button size="lg" onClick={save} disabled={pending || (!isDraft && !changed)}>
          <Save aria-hidden /> {pending ? t("upload.saving") : isDraft ? t("upload.saveRecord") : t("common.save")}
        </Button>
        {!isDraft && changed ? (
          <Button variant="ghost" onClick={() => { setDraft(record.extracted); setForceEdit(false); }}>
            {t("common.cancel")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FlagBadge({ flag, t }: { flag: ReturnType<typeof flagForLabValue>; t: (key: MessageKey) => string }) {
  if (flag === "HIGH") return <Badge variant="attention">{t("record.values.high")}</Badge>;
  if (flag === "LOW") return <Badge variant="attention">{t("record.values.low")}</Badge>;
  if (flag === "NORMAL") return <Badge variant="success">{t("record.values.normal")}</Badge>;
  return <Badge variant="neutral">{t("record.values.unknown")}</Badge>;
}
