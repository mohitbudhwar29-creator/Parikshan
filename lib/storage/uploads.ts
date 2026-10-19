import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { MAX_UPLOAD_BYTES } from "@/lib/upload/limits";

// Upload storage. Files live under UPLOAD_DIR (outside /public), are named by random keys,
// and are only read through an ownership-checked route. The browser's declared type is never trusted:
// the real type is decided from the file's first bytes (magic numbers).

export { MAX_UPLOAD_BYTES };

export type AllowedMime = "image/jpeg" | "image/png" | "application/pdf";

const KEY_PATTERN = /^[A-Za-z0-9-]{8,64}\.(jpg|png|pdf)$/;

export function uploadDirectory(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./storage/uploads");
}

export function extensionForMime(mimeType: string): "jpg" | "png" | "pdf" | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "application/pdf":
      return "pdf";
    default:
      return null;
  }
}

/** Decides the real type from the first bytes. Returns null for anything that is not JPEG, PNG or PDF. */
export function detectFileType(buffer: Buffer): AllowedMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

export async function saveUpload(buffer: Buffer, mimeType: string): Promise<string> {
  const extension = extensionForMime(mimeType);
  if (!extension) throw new Error("unsupported upload type");
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true });
  const key = `${randomUUID()}.${extension}`;
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(directory, key), buffer, { flag: "wx" });
  return key;
}

function resolveKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error("invalid storage key");
  const directory = uploadDirectory();
  const resolved = path.resolve(directory, key);
  if (!resolved.startsWith(directory + path.sep)) throw new Error("invalid storage key");
  return resolved;
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

/** Deletes a stored file. A missing file is not an error (the record may already be gone). */
export async function deleteStoredFile(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await unlink(resolveKey(key));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

export function mimeForKey(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".png")) return "image/png";
  return "image/jpeg";
}
