import { medicationStatus, slotsForTimesPerDay, type MedicationStatus } from "@/lib/health/medication-schedule";
import type { DoseSlot } from "@/types/health";

// Plain view model for medicines. Pure, so it can be shared with client components.

export interface MedicineCardData {
  id: string;
  name: string;
  dosage: string;
  timesPerDay: number;
  durationDays: number | null;
  startDate: string;
  endDate: string | null;
  notes: string;
  status: MedicationStatus;
  scheduledSlots: DoseSlot[];
  takenSlots: DoseSlot[];
  sourceTitle: string | null;
  sourceType: string | null;
}

export interface MedicineRowInput {
  id: string;
  name: string;
  dosage: string;
  timesPerDay: number;
  durationDays: number | null;
  startDate: Date;
  endDate: Date | null;
  notes: string | null;
  doseLogs: { slot: string }[];
  sourceRecord: { title: string; type: string } | null;
}

export function toMedicineCard(row: MedicineRowInput, today: Date): MedicineCardData {
  const scheduledSlots = slotsForTimesPerDay(row.timesPerDay);
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage,
    timesPerDay: row.timesPerDay,
    durationDays: row.durationDays,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate ? row.endDate.toISOString() : null,
    notes: row.notes ?? "",
    status: medicationStatus({ startDate: row.startDate, endDate: row.endDate }, today),
    scheduledSlots,
    takenSlots: row.doseLogs.map((log) => log.slot as DoseSlot).filter((slot) => scheduledSlots.includes(slot)),
    sourceTitle: row.sourceRecord?.title ?? null,
    sourceType: row.sourceRecord?.type ?? null,
  };
}
