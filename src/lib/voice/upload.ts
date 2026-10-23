import { SUPPORTED_AUDIO_TYPES } from "./config";
import { httpStatusForVoiceError } from "./errors";
import type { VoiceErrorCode } from "./errors";

/**
 * Bounded, verified audio uploads.
 *
 * Two gaps in the path *into* a speech provider, both worth closing here rather
 * than in each route:
 *
 * 1. `await request.formData()` buffers whatever the client sends. `Content-Length`
 *    is a courtesy, not a promise: a chunked upload can omit it, so the advertised
 *    size check passes and the full body is buffered before anyone learns how big
 *    it actually is. Here the stream is counted while it arrives and cancelled the
 *    moment it exceeds the cap, so the excess is never buffered — and a stalled
 *    upload is abandoned on a deadline instead of holding the route open.
 *
 * 2. A declared MIME type is the client's claim about its own bytes. Forwarding
 *    audio to a provider because `type` said `audio/webm` lets any caller use this
 *    app as an unauthenticated-by-content proxy for arbitrary payloads. The
 *    container is read from the bytes themselves; an unrecognisable header, or one
 *    that contradicts the declared type, is rejected before a provider is called.
 *
 * Nothing here decides policy: it returns `VoiceErrorCode`s from the existing
 * vocabulary so routes keep mapping them to statuses in one place.
 */

/**
 * Status for a rejection from this module. `INVALID_REQUEST` is answered with 400
 * here rather than the 422 `httpStatusForVoiceError` gives it, because on these routes
 * it means "there was no usable body at all" — a malformed request, not a semantic
 * rejection of a well-formed one.
 */
export function uploadErrorStatus(code: VoiceErrorCode): number {
  return code === "INVALID_REQUEST" ? 400 : httpStatusForVoiceError(code);
}

/** A clip shorter than this cannot contain a usable audio frame. */
export const MIN_AUDIO_BYTES = 512;

/** How long a client may take to push a clip it already has in memory. */
export const UPLOAD_TIMEOUT_MS = 20_000;

/**
 * Ceiling for a JSON body on the speak route. That endpoint carries a message id,
 * not text, so a request an order of magnitude larger than this is not a client
 * this app wrote.
 */
export const MAX_JSON_BODY_BYTES = 32 * 1024;

/**
 * Multipart framing (boundary lines, part headers) added on top of the audio file
 * itself. The per-file cap is applied to the decoded part, so the raw body is
 * allowed this much slack before it is refused as too large.
 */
export const MULTIPART_FRAMING_BYTES = 64 * 1024;

export type BoundedBody =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; code: VoiceErrorCode };

const TIMEOUT = Symbol("upload-timeout");

/**
 * Reads a request body into memory, never exceeding `maxBytes` and never waiting
 * longer than `timeoutMs`. `Content-Length` is honoured only to reject an obviously
 * oversized request early — the real accounting happens on the stream.
 */
export async function readBoundedBody(
  request: Request,
  maxBytes: number,
  options: { timeoutMs?: number } = {},
): Promise<BoundedBody> {
  const timeoutMs = options.timeoutMs ?? UPLOAD_TIMEOUT_MS;

  const declared = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, code: "AUDIO_TOO_LARGE" };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, code: "INVALID_REQUEST" };

  const chunks: Uint8Array[] = [];
  let total = 0;
  const startedAt = Date.now();

  for (;;) {
    const remaining = timeoutMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, code: "TIMEOUT" };
    }

    const next = await Promise.race([
      reader.read(),
      // Deliberately not `unref()`ed: an unref'd timer does not hold the event loop,
      // so a stalled upload in a quiet process would leave this promise pending
      // forever instead of reporting TIMEOUT. The timer is cleared below, so the most
      // it can ever hold the loop is the remaining deadline of one request.
      new Promise<typeof TIMEOUT>((resolve) => {
        setTimeout(() => resolve(TIMEOUT), remaining);
      }),
    ]);

    if (next === TIMEOUT) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, code: "TIMEOUT" };
    }

    const { done, value } = next as ReadableStreamReadResult<Uint8Array>;
    if (done) break;
    if (!value || value.byteLength === 0) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      // The bytes past the cap are dropped, not buffered: this is the whole point.
      await reader.cancel().catch(() => undefined);
      return { ok: false, code: "AUDIO_TOO_LARGE" };
    }
    chunks.push(value);
  }

  if (total === 0) return { ok: false, code: "INVALID_REQUEST" };

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: merged };
}

/**
 * Re-parses an already-buffered body with the platform's own multipart reader, so
 * a route keeps `form.get("audio")` semantics while the *read* stays bounded.
 */
export async function formDataFromBytes(
  bytes: Uint8Array,
  contentType: string | null,
): Promise<FormData | null> {
  if (!contentType) return null;
  try {
    // Copied into a fresh `ArrayBuffer` rather than handed over as a view: a
    // `Uint8Array<ArrayBufferLike>` is not a `BlobPart`, and a detached or shared
    // buffer would let the caller change the bytes mid-parse.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const response = new Response(new Blob([buffer], { type: contentType }));
    return await response.formData();
  } catch {
    return null;
  }
}

export type AudioContainer = "webm" | "ogg" | "wav" | "mp4" | "mp3" | "aac";

const CONTAINER_TO_MIME: Record<AudioContainer, readonly string[]> = {
  webm: ["audio/webm"],
  ogg: ["audio/ogg"],
  wav: ["audio/wav", "audio/x-wav"],
  mp4: ["audio/mp4", "audio/m4a"],
  mp3: ["audio/mpeg"],
  aac: ["audio/aac"],
};

/** `audio/webm;codecs=opus` → `audio/webm`. */
export function normalizeMimeType(value: string | null | undefined): string {
  return String(value ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase() ?? "";
}

/**
 * Identifies a container from its magic bytes, without decoding audio. Kept to the
 * headers `MediaRecorder` and the usual mobile recorders actually produce, which is
 * the same set `SUPPORTED_AUDIO_TYPES` allows.
 */
export function sniffAudioContainer(bytes: Uint8Array): AudioContainer | null {
  if (bytes.length < 12) return null;
  const at = (offset: number, text: string) =>
    [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

  if (at(0, "RIFF") && at(8, "WAVE")) return "wav";
  if (at(0, "OggS")) return "ogg";
  if (at(4, "ftyp")) return "mp4";
  // Matroska/WebM: EBML magic 1A 45 DF A3.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (at(0, "ID3")) return "mp3";
  // MPEG audio frame sync without an ID3 tag.
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  // ADTS AAC frame sync.
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "aac";
  return null;
}

export type AudioVerdict =
  | { ok: true; container: AudioContainer; mime: string }
  | {
      ok: false;
      code: VoiceErrorCode;
      reason: "TOO_SMALL" | "NO_AUDIO_HEADER" | "CONTAINER_MISMATCH" | "UNSUPPORTED_TYPE";
    };

/**
 * Checks the bytes against the declared type. The declaration still has to be on
 * the allow list — that keeps the error messages the routes already speak — and
 * then the header has to agree with it.
 */
export function verifyAudioBytes(
  bytes: Uint8Array,
  declaredMime: string | null | undefined,
): AudioVerdict {
  const mime = normalizeMimeType(declaredMime);
  if (!(SUPPORTED_AUDIO_TYPES as readonly string[]).includes(mime)) {
    return { ok: false, code: "UNSUPPORTED_AUDIO", reason: "UNSUPPORTED_TYPE" };
  }
  if (bytes.byteLength < MIN_AUDIO_BYTES) {
    return { ok: false, code: "EMPTY_TRANSCRIPT", reason: "TOO_SMALL" };
  }

  const container = sniffAudioContainer(bytes);
  if (!container) {
    return { ok: false, code: "UNSUPPORTED_AUDIO", reason: "NO_AUDIO_HEADER" };
  }
  if (!CONTAINER_TO_MIME[container].includes(mime)) {
    return { ok: false, code: "UNSUPPORTED_AUDIO", reason: "CONTAINER_MISMATCH" };
  }
  return { ok: true, container, mime };
}
