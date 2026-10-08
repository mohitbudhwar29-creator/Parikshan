import { getOptionalUserId } from "@/lib/auth/context";
import { getRecordForUser } from "@/lib/database/records";
import { mimeForKey, readStoredFile } from "@/lib/storage/uploads";
import { logSafe } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams the original uploaded document. Only the owner of the record can read it. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const userId = await getOptionalUserId();
  if (!userId) return Response.json({ ok: false, errorKey: "error.unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const record = await getRecordForUser(userId, id);
  if (!record || !record.fileKey) return Response.json({ ok: false, errorKey: "record.notFound" }, { status: 404 });
  try {
    const bytes = await readStoredFile(record.fileKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeForKey(record.fileKey),
        "Content-Disposition": `inline; filename="${(record.fileName ?? "document").replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logSafe("file read failed", error);
    return Response.json({ ok: false, errorKey: "record.notFound" }, { status: 404 });
  }
}
