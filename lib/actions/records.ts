"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { extractedRecordSchema, type ExtractedRecord, type HealthSummary } from "@/types/health";
import type { ActionResult } from "@/types";
import { requireUserId } from "@/lib/auth/session";
import { getServerPrefs } from "@/lib/prefs/server";
import { getRecordForUser, deleteRecordForProfile, saveConfirmedRecord, saveRecordSummary } from "@/lib/database/records";
import { findProfileForUser } from "@/lib/database/profiles";
import { buildHealthContext } from "@/lib/health/context";
import { generateSummary } from "@/lib/ai";
import { deleteStoredFile } from "@/lib/storage/uploads";
import { logSafe } from "@/lib/logging";
import { idSchema } from "@/lib/validation/schemas";

/** Confirms a draft (or re-confirms a saved record after edits). The payload is re-validated on the server. */
export async function confirmRecordAction(recordId: string, payloadJson: string): Promise<ActionResult<{ recordId: string }>> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(recordId);
  if (!id.success) return { ok: false, errorKey: "upload.saveFailed" };

  let raw: unknown;
  try {
    raw = JSON.parse(payloadJson);
  } catch {
    return { ok: false, errorKey: "upload.saveFailed" };
  }
  const parsed = extractedRecordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorKey: "upload.saveFailed", detail: parsed.error.issues[0]?.message };

  const record = await getRecordForUser(userId, id.data);
  if (!record) return { ok: false, errorKey: "record.notFound" };

  try {
    const saved = await saveConfirmedRecord({
      profileId: record.profileId,
      extracted: parsed.data as ExtractedRecord,
      file: record.fileKey && record.fileName && record.mimeType
        ? { fileKey: record.fileKey, fileName: record.fileName, mimeType: record.mimeType }
        : null,
      rawText: record.rawText,
      ocrProvider: record.ocrProvider,
      recordId: record.id,
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { recordId: saved } };
  } catch (error) {
    logSafe("confirmRecord failed", error);
    return { ok: false, errorKey: "upload.saveFailed" };
  }
}

export async function deleteRecordAction(recordId: string): Promise<void> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(recordId);
  if (!id.success) redirect("/timeline");
  const record = await getRecordForUser(userId, id.data);
  if (!record) redirect("/timeline");
  const fileKey = await deleteRecordForProfile(record.profileId, record.id);
  if (fileKey && fileKey !== "NOT_FOUND") await deleteStoredFile(fileKey);
  revalidatePath("/", "layout");
  redirect("/timeline?deleted=1");
}

/** On-demand summary for one record, grounded only in that record's stored values. Cached per locale. */
export async function generateSummaryAction(recordId: string): Promise<ActionResult<HealthSummary>> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(recordId);
  if (!id.success) return { ok: false, errorKey: "error.actionFailed" };
  const record = await getRecordForUser(userId, id.data);
  if (!record) return { ok: false, errorKey: "record.notFound" };
  const profile = await findProfileForUser(userId, record.profileId);
  if (!profile) return { ok: false, errorKey: "record.notFound" };
  const prefs = await getServerPrefs();
  try {
    const context = await buildHealthContext(profile);
    const summary = await generateSummary({ context, recordId: record.id, locale: prefs.lang });
    await saveRecordSummary(record.id, profile.id, JSON.stringify(summary));
    revalidatePath(`/records/${record.id}`);
    return { ok: true, data: summary };
  } catch (error) {
    logSafe("generateSummary failed", error);
    return { ok: false, errorKey: "error.generic" };
  }
}
