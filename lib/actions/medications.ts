"use server";

import { revalidatePath } from "next/cache";
import { medicationInputSchema, doseToggleSchema, idSchema, type MedicationInput } from "@/lib/validation/schemas";
import { createManualMedication, deleteMedicationForProfile, setDoseForToday } from "@/lib/database/medications";
import { requireAppContext } from "@/lib/auth/context";
import type { ActionResult } from "@/types";
import { fieldErrorsFrom, formString, type FieldErrors } from "./shared";
import type { DoseSlot } from "@/types/health";

export interface MedicationFormState {
  errorKey?: "error.actionFailed" | "meds.saved";
  fieldErrors?: FieldErrors;
  saved?: boolean;
}

/** Adds a medicine entered by hand to the active profile. */
export async function addMedicationAction(_previous: MedicationFormState | null, formData: FormData): Promise<MedicationFormState> {
  const { profile } = await requireAppContext();
  const parsed = medicationInputSchema.safeParse({
    name: formString(formData, "name"),
    dosage: formString(formData, "dosage"),
    timesPerDay: Number(formString(formData, "timesPerDay") || "1"),
    startDate: formString(formData, "startDate"),
    endDate: formString(formData, "endDate"),
    notes: formString(formData, "notes"),
  });
  if (!parsed.success) return { errorKey: "error.actionFailed", fieldErrors: fieldErrorsFrom(parsed.error) };
  await createManualMedication(profile.id, parsed.data as MedicationInput);
  revalidatePath("/medications");
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function deleteMedicationAction(medicationId: string): Promise<ActionResult> {
  const { profile } = await requireAppContext();
  const id = idSchema.safeParse(medicationId);
  if (!id.success) return { ok: false, errorKey: "error.actionFailed" };
  const removed = await deleteMedicationForProfile(profile.id, id.data);
  if (!removed) return { ok: false, errorKey: "error.actionFailed" };
  revalidatePath("/medications");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

/** Marks today's dose for a slot as taken, or undoes it. Date is the server's current UTC day. */
export async function toggleDoseAction(medicationId: string, slot: DoseSlot, taken: boolean): Promise<ActionResult> {
  const { profile } = await requireAppContext();
  const parsed = doseToggleSchema.safeParse({ medicationId, slot, taken });
  if (!parsed.success) return { ok: false, errorKey: "error.actionFailed" };
  const updated = await setDoseForToday(profile.id, parsed.data.medicationId, parsed.data.slot, parsed.data.taken);
  if (!updated) return { ok: false, errorKey: "error.actionFailed" };
  revalidatePath("/medications");
  revalidatePath("/dashboard");
  revalidatePath("/caregiver");
  return { ok: true, data: undefined };
}
