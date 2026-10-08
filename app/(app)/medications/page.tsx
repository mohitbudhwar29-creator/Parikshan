import type { Metadata } from "next";
import { requireAppContext } from "@/lib/auth/context";
import { listMedicationsForProfile } from "@/lib/database/medications";
import { createTranslator } from "@/lib/i18n";
import { toMedicineCard } from "@/lib/medications/view";
import { toDateInputValue } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page";
import { Alert } from "@/components/ui/alert";
import { MedicationList } from "@/components/medications/medication-list";
import { AddMedicationForm } from "@/components/medications/add-medication-form";
import { Info } from "lucide-react";

export const metadata: Metadata = { title: "Medications" };

export default async function MedicationsPage() {
  const { profile, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const today = new Date();
  const rows = await listMedicationsForProfile(profile.id, today);
  const cards = rows.map((row) => toMedicineCard(row, today));

  return (
    <div className="space-y-8">
      <PageHeader title={t("meds.title")} subtitle={t("meds.subtitle")} />
      <Alert variant="info">
        <Info className="size-5 shrink-0" aria-hidden />
        <span>{t("meds.neverRecommend")}</span>
      </Alert>
      <section aria-labelledby="my-medicines" className="space-y-4">
        <h2 id="my-medicines" className="sr-only">{t("meds.title")}</h2>
        {cards.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("meds.empty")}</p> : <MedicationList medicines={cards} />}
      </section>
      <AddMedicationForm today={toDateInputValue(today)} />
    </div>
  );
}
