import type { Medication } from "@/lib/generated/prisma/client";
import { prisma } from "./prisma";
import { endDateForDuration } from "@/lib/health/medication-schedule";
import { startOfUtcDay } from "@/lib/utils";
import type { DoseSlot } from "@/types/health";
import type { MedicationInput } from "@/lib/validation/schemas";

export type MedicationWithDoses = Medication & {
  doseLogs: { slot: string }[];
  sourceRecord: { title: string; type: string; recordDate: Date } | null;
};

/** Medicines for a profile with today's taken doses attached. */
export async function listMedicationsForProfile(profileId: string, today: Date = new Date()): Promise<MedicationWithDoses[]> {
  const day = startOfUtcDay(today);
  return prisma.medication.findMany({
    where: { profileId },
    include: {
      doseLogs: { where: { doseDate: day }, select: { slot: true } },
      sourceRecord: { select: { title: true, type: true, recordDate: true } },
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
  });
}

export async function createManualMedication(profileId: string, input: MedicationInput): Promise<void> {
  const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDate = input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null;
  const durationDays = endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1 : null;
  await prisma.medication.create({
    data: {
      profileId,
      name: input.name,
      dosage: input.dosage,
      frequency: "",
      timesPerDay: input.timesPerDay,
      durationDays,
      startDate,
      endDate: endDate ?? endDateForDuration(startDate, null),
      notes: input.notes || null,
    },
  });
}

/** Deletes a medicine only if it belongs to the profile. Returns false when not found. */
export async function deleteMedicationForProfile(profileId: string, medicationId: string): Promise<boolean> {
  const result = await prisma.medication.deleteMany({ where: { id: medicationId, profileId } });
  return result.count === 1;
}

/** Marks today's dose as taken (or undoes it). Ownership is verified before writing. */
export async function setDoseForToday(
  profileId: string,
  medicationId: string,
  slot: DoseSlot,
  taken: boolean,
  today: Date = new Date(),
): Promise<boolean> {
  const medication = await prisma.medication.findFirst({ where: { id: medicationId, profileId }, select: { id: true } });
  if (!medication) return false;
  const doseDate = startOfUtcDay(today);
  if (taken) {
    await prisma.doseLog.upsert({
      where: { medicationId_doseDate_slot: { medicationId, doseDate, slot } },
      create: { medicationId, doseDate, slot },
      update: { takenAt: new Date() },
    });
  } else {
    await prisma.doseLog.deleteMany({ where: { medicationId, doseDate, slot } });
  }
  return true;
}
