import test from "node:test";
import assert from "node:assert/strict";

import {
  MIN_AUDIO_BYTES,
  formDataFromBytes,
  normalizeMimeType,
  readBoundedBody,
  sniffAudioContainer,
  uploadErrorStatus,
  verifyAudioBytes,
} from "@/lib/voice/upload";
import { buildSpokenText } from "@/lib/voice/spoken";

/** WebM/Matroska files start with the EBML header 1A 45 DF A3. */
function webmBytes(size = MIN_AUDIO_BYTES + 32) {
  const bytes = new Uint8Array(size);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f], 0);
  bytes.set([0x83, 0x77, 0x65, 0x62, 0x6d], 12); // "webm" doc type, so it is not just a magic prefix
  return bytes;
}

function streamRequest(
  chunks: Uint8Array[],
  options: { stall?: boolean; headers?: Record<string, string> } = {},
): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (!options.stall) controller.close();
    },
  });
  const init: RequestInit & { duplex?: "half" } = {
    method: "POST",
    body: stream as unknown as BodyInit,
    duplex: "half",
    headers: { "content-type": "multipart/form-data; boundary=seg", ...options.headers },
  };
  return new Request("http://localhost/api/voice/transcribe", init);
}

test("a chunked upload with no Content-Length is still stopped at the cap", async () => {
  // The bypass this closes: nothing advertises a size, so an advertised-size check
  // cannot reject it. The bound has to live in the reader.
  const oversized = Array.from({ length: 40 }, () => new Uint8Array(64 * 1024));
  const result = await readBoundedBody(streamRequest(oversized), 256 * 1024);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "AUDIO_TOO_LARGE");
});

test("an oversized declared Content-Length is refused before any reading starts", async () => {
  const request = streamRequest([new Uint8Array(16)], { headers: { "content-length": "999999999" } });
  const result = await readBoundedBody(request, 1024);
  assert.deepEqual(result, { ok: false, code: "AUDIO_TOO_LARGE" });
});

test("a body exactly at the cap is accepted, and a stalled upload is abandoned", async () => {
  const ok = await readBoundedBody(streamRequest([new Uint8Array(1024)]), 1024);
  assert.equal(ok.ok, true);

  const stalled = await readBoundedBody(
    streamRequest([new Uint8Array(64)], { stall: true }),
    1024 * 1024,
    { timeoutMs: 40 },
  );
  assert.equal(stalled.ok, false);
  if (!stalled.ok) assert.equal(stalled.code, "TIMEOUT");
});

test("an empty body is a client error, not a provider failure", async () => {
  const result = await readBoundedBody(streamRequest([]), 1024);
  assert.deepEqual(result, { ok: false, code: "INVALID_REQUEST" });
});

test("the buffered body still parses as the multipart form the route expects", async () => {
  const form = new FormData();
  form.append("audio", new Blob([webmBytes()], { type: "audio/webm" }), "clip.webm");
  form.append("language", "hi");

  const source = new Request("http://localhost/api/voice/transcribe", { method: "POST", body: form });
  const read = await readBoundedBody(source, 4 * 1024 * 1024);
  assert.equal(read.ok, true);
  if (!read.ok) return;

  const parsed = await formDataFromBytes(read.bytes, source.headers.get("content-type"));
  assert.ok(parsed);
  const file = parsed.get("audio");
  assert.ok(file instanceof File);
  assert.equal(file.name, "clip.webm");
  assert.equal(parsed.get("language"), "hi");
  assert.equal(sniffAudioContainer(new Uint8Array(await file.arrayBuffer())), "webm");
});

test("bytes that are not an audio container are rejected whatever they are called", () => {
  const notAudio = new TextEncoder().encode("-----BEGIN OPENSSH PRIVATE KEY-----\n".repeat(40));
  assert.equal(notAudio.byteLength > MIN_AUDIO_BYTES, true);

  const verdict = verifyAudioBytes(notAudio, "audio/webm");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) {
    assert.equal(verdict.code, "UNSUPPORTED_AUDIO");
    assert.equal(verdict.reason, "NO_AUDIO_HEADER");
  }
});

test("a declared type that contradicts the header is rejected", () => {
  const mismatched = verifyAudioBytes(webmBytes(), "audio/mpeg");
  assert.equal(mismatched.ok, false);
  if (!mismatched.ok) assert.equal(mismatched.reason, "CONTAINER_MISMATCH");

  const declaredUnsupported = verifyAudioBytes(webmBytes(), "audio/flac");
  assert.equal(declaredUnsupported.ok, false);
  if (!declaredUnsupported.ok) assert.equal(declaredUnsupported.reason, "UNSUPPORTED_TYPE");

  // A valid header that is too short to hold a frame is its own answer.
  const stub = verifyAudioBytes(webmBytes().slice(0, 16), "audio/webm");
  assert.equal(stub.ok, false);
  if (!stub.ok) assert.equal(stub.reason, "TOO_SMALL");
});

test("real recordings pass, including codec parameters in the type", () => {
  const verdict = verifyAudioBytes(webmBytes(), "audio/webm;codecs=opus");
  assert.deepEqual(verdict, { ok: true, container: "webm", mime: "audio/webm" });

  const wav = new Uint8Array(MIN_AUDIO_BYTES + 8);
  wav.set([0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45], 0); // RIFF....WAVE
  assert.equal(verifyAudioBytes(wav, "audio/wav").ok, true);

  assert.equal(normalizeMimeType("AUDIO/OGG;charset=binary"), "audio/ogg");
});

test("spoken text never reads a citation marker as a number", () => {
  const spoken = buildSpokenText("Your HbA1c was 7.2% on 12 Mar 2026. [1] Discuss it with your team. [2, 3]");
  assert.doesNotMatch(spoken, /\[\d/);
  assert.doesNotMatch(spoken, /\.\s*\./);
  // The values a listener needs survive the cleanup.
  assert.match(spoken, /7\.2%/);
  assert.match(spoken, /12 Mar 2026/);
  // A named markdown link still keeps its text, which is the reader's label.
  assert.match(buildSpokenText("See [the report](https://example.com/r)."), /the report/);
});

test("rejections keep the statuses these routes already answered with", async () => {
  // A missing body was 400 on both routes before this change; the bound must not
  // quietly turn it into a 422 that the browser hook maps to different copy.
  const empty = new Request("http://localhost/api/voice/transcribe", { method: "POST" });
  const result = await readBoundedBody(empty, 1024);
  assert.deepEqual(result, { ok: false, code: "INVALID_REQUEST" });
  assert.equal(uploadErrorStatus("INVALID_REQUEST"), 400);
  assert.equal(uploadErrorStatus("AUDIO_TOO_LARGE"), 413);
  assert.equal(uploadErrorStatus("TIMEOUT"), 504);
  assert.equal(uploadErrorStatus("UNSUPPORTED_AUDIO"), 415);
  assert.equal(uploadErrorStatus("EMPTY_TRANSCRIPT"), 422);
});
