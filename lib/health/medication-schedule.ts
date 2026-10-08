import { addUtcDays, DAY_MS, startOfUtcDay } from "@/lib/utils";
import type { DoseSlot, MetricName } from "@/types/health";
import type { MessageKey } from "@/lib/i18n/en";

export type MedicationStatus = "ACTIVE" | "UPCOMING" | "COMPLETED";

/**
 * Status is derived from dates on every read, so it never goes stale.
 * Start after today: upcoming. End before today: completed. Otherwise active (no end date = ongoing).
 */
export function medicationStatus(
  medication: { startDate: Date; endDate: Date | null },
  today: Date = new Date(),
): MedicationStatus {
  const day = startOfUtcDay(today).getTime();
  if (startOfUtcDay(medication.startDate).getTime() > day) return "UPCOMING";
  if (medication.endDate && startOfUtcDay(medication.endDate).getTime() < day) return "COMPLETED";
  return "ACTIVE";
}

/** Inclusive number of days between start and end (both included). */
export function durationInDays(startDate: Date, endDate: Date | null): number | null {
  if (!endDate) return null;
  const days = Math.round((startOfUtcDay(endDate).getTime() - startOfUtcDay(startDate).getTime()) / DAY_MS);
  return days + 1;
}

/** End date for a course that lasts `durationDays` days starting on `startDate` (inclusive). */
export function endDateForDuration(startDate: Date, durationDays: number | null | undefined): Date | null {
  if (!durationDays || durationDays < 1) return null;
  return addUtcDays(startDate, durationDays - 1);
}

const SLOTS_BY_COUNT: Record<number, DoseSlot[]> = {
  0: [],
  1: ["MORNING"],
  2: ["MORNING", "NIGHT"],
  3: ["MORNING", "AFTERNOON", "NIGHT"],
};

export function slotsForTimesPerDay(timesPerDay: number): DoseSlot[] {
  return SLOTS_BY_COUNT[Math.min(Math.max(timesPerDay, 0), 3)] ?? [];
}

export function frequencyLabelKey(timesPerDay: number): MessageKey {
  if (timesPerDay >= 3) return "meds.freq.thrice";
  if (timesPerDay === 2) return "meds.freq.twice";
  if (timesPerDay === 1) return "meds.freq.once";
  return "meds.freq.asNeeded";
}

export const SLOT_ORDER: DoseSlot[] = ["MORNING", "AFTERNOON", "NIGHT"];

export function slotLabelKey(slot: DoseSlot): MessageKey {
  return slot === "MORNING" ? "meds.slot.morning" : slot === "AFTERNOON" ? "meds.slot.afternoon" : "meds.slot.night";
}

export function slotTimeKey(slot: DoseSlot): MessageKey {
  return slot === "MORNING"
    ? "meds.slot.morningTime"
    : slot === "AFTERNOON"
      ? "meds.slot.afternoonTime"
      : "meds.slot.nightTime";
}

/** The metric names that appear on a blood pressure line, used when deriving diastolic readings. */
export const BLOOD_PRESSURE_METRICS: MetricName[] = ["blood_pressure_systolic", "blood_pressure_diastolic"];
