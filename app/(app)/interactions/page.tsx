import type { Metadata } from "next";
import { requireAppContext } from "@/lib/auth/context";
import { listMedicationsForProfile } from "@/lib/database/medications";
import { createTranslator } from "@/lib/i18n";
import { medicationStatus } from "@/lib/health/medication-schedule";
import { PageHeader } from "@/components/ui/page";
import { Alert } from "@/components/ui/alert";
import { InteractionChecker } from "@/components/interactions/checker";
import { Info } from "lucide-react";

export const metadata: Metadata = { title: "Drug Interactions" };

export default async function InteractionsPage() {
  const { profile, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const today = new Date();
  const medicines = await listMedicationsForProfile(profile.id, today);
  const names = [
    ...new Set(
      medicines
        .filter((medicine) => medicationStatus({ startDate: medicine.startDate, endDate: medicine.endDate }, today) !== "COMPLETED")
        .map((medicine) => medicine.name),
    ),
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t("interactions.title")} subtitle={t("interactions.subtitle")} />
      <Alert variant="warning">
        <Info className="size-5 shrink-0" aria-hidden />
        <span>{t("interactions.mockNotice")}</span>
      </Alert>
      <InteractionChecker medicineNames={names} />
    </div>
  );
}
