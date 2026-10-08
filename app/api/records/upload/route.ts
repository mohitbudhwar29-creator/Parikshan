import { getOptionalUserId } from "@/lib/auth/context";
import { findProfileForUser } from "@/lib/database/profiles";
import { createDraftRecord } from "@/lib/database/records";
import { detectFileType, MAX_UPLOAD_BYTES, saveUpload, type AllowedMime } from "@/lib/storage/uploads";
import { extractTextFromImage } from "@/lib/ocr";
import { extractMedicalData } from "@/lib/ai";
import { sleep } from "@/lib/utils";
import { logSafe } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DECLARED_TYPES = new Set<string>(["image/jpeg", "image/png", "application/pdf"]);
const STAGE_PAUSE_MS = 650;

type StreamEvent =
  | { stage: "reading" | "extracting" | "understanding" | "preparing" }
  | { stage: "done"; recordId: string }
  | { stage: "error"; errorKey: string };

function errorResponse(status: number, errorKey: string): Response {
  return Response.json({ ok: false, errorKey }, { status, headers: { "Cache-Control": "no-store" } });
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9 ._-]/g, "_").trim().slice(0, 120);
  return cleaned || "document";
}

/**
 * Upload pipeline. Responds with newline-delimited JSON so the browser can show each stage as it happens:
 * reading -> extracting -> understanding -> preparing -> done (with the draft record id).
 * Nothing is saved as a confirmed record here: the result is a draft the user must review first.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await getOptionalUserId();
  if (!userId) return errorResponse(401, "upload.errorSignIn");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "upload.errorUpload");
  }

  const file = form.get("file");
  const profileId = form.get("profileId");
  if (!(file instanceof File) || typeof profileId !== "string") return errorResponse(400, "upload.errorUpload");
  if (file.size === 0) return errorResponse(400, "upload.errorEmpty");
  if (file.size > MAX_UPLOAD_BYTES) return errorResponse(413, "upload.errorSize");
  if (!ALLOWED_DECLARED_TYPES.has(file.type)) return errorResponse(415, "upload.errorType");

  const profile = await findProfileForUser(userId, profileId);
  if (!profile) return errorResponse(404, "error.noSuchProfile");

  const buffer = Buffer.from(await file.arrayBuffer());
  // The real content decides the type. A renamed or disguised file is rejected here.
  const detected: AllowedMime | null = detectFileType(buffer);
  if (!detected) return errorResponse(415, "upload.errorContent");
  if (detected !== file.type) return errorResponse(415, "upload.errorContent");

  const fileName = safeFileName(file.name);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      void (async () => {
        try {
          send({ stage: "reading" });
          const ocr = await extractTextFromImage({ buffer, mimeType: detected, fileName });
          await sleep(STAGE_PAUSE_MS);

          send({ stage: "extracting" });
          const extracted = await extractMedicalData({
            text: ocr.text,
            ocrConfidence: ocr.averageConfidence,
            fallbackDate: new Date().toISOString().slice(0, 10),
          });
          await sleep(STAGE_PAUSE_MS);

          send({ stage: "understanding" });
          await sleep(STAGE_PAUSE_MS);

          send({ stage: "preparing" });
          const key = await saveUpload(buffer, detected);
          const recordId = await createDraftRecord({
            profileId: profile.id,
            extracted,
            file: { fileKey: key, fileName, mimeType: detected },
            rawText: ocr.text,
            ocrProvider: ocr.provider,
          });
          send({ stage: "done", recordId });
        } catch (error) {
          logSafe("upload pipeline failed", error);
          send({ stage: "error", errorKey: "upload.processingFailed" });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
