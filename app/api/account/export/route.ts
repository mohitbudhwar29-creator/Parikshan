import { getOptionalUserId } from "@/lib/auth/context";
import { findProfileForUser } from "@/lib/database/profiles";
import { prisma } from "@/lib/database/prisma";
import { buildFhirBundle, type ExportRecord } from "@/lib/fhir/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downloads one profile as a FHIR R4 bundle (JSON). Uploaded files and ABHA numbers are not included.
 * Ownership is checked before anything is read.
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await getOptionalUserId();
  if (!userId) return Response.json({ ok: false, errorKey: "error.unauthorized" }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";
  const profile = await findProfileForUser(userId, profileId);
  if (!profile) return Response.json({ ok: false, errorKey: "error.noSuchProfile" }, { status: 404 });

  const records = await prisma.healthRecord.findMany({
    where: { profileId: profile.id, status: "SAVED" },
    include: { labResults: true, medications: true },
    orderBy: { recordDate: "asc" },
  });

  const exportRecords: ExportRecord[] = records.map((record) => ({
    id: record.id,
    type: record.type,
    title: record.title,
    recordDate: record.recordDate,
    doctorName: record.doctorName,
    facility: record.facility,
    diagnosisTerms: parseTerms(record.extractedJson),
    fileName: record.fileName,
    labs: record.labResults.map((lab) => ({
      id: lab.id,
      testName: lab.testName,
      value: lab.value,
      numericValue: lab.numericValue,
      unit: lab.unit,
      referenceRange: lab.referenceRange,
      flag: lab.flag,
    })),
    medications: record.medications.map((medicine) => ({
      id: medicine.id,
      name: medicine.name,
      dosage: medicine.dosage,
      frequency: medicine.frequency,
      timesPerDay: medicine.timesPerDay,
      durationDays: medicine.durationDays,
      startDate: medicine.startDate,
      endDate: medicine.endDate,
      notes: medicine.notes,
    })),
  }));

  const bundle = buildFhirBundle(
    { id: profile.id, name: profile.name, dateOfBirth: profile.dateOfBirth },
    exportRecords,
    new Date(),
  );
  const safeName = profile.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase().slice(0, 40) || "profile";
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/fhir+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="health-export-${safeName}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function parseTerms(extractedJson: string | null): string[] {
  if (!extractedJson) return [];
  try {
    const parsed = JSON.parse(extractedJson) as { diagnosisTerms?: unknown };
    return Array.isArray(parsed.diagnosisTerms) ? parsed.diagnosisTerms.filter((term): term is string => typeof term === "string") : [];
  } catch {
    return [];
  }
}
