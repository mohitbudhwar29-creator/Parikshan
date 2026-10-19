// Audio format detection by file signature (magic bytes). The browser's declared type is never trusted.

export type AudioFormat = "webm" | "ogg" | "mp4" | "wav" | "mp3";

/** Recordings shorter than this are treated as empty (no real speech can fit in fewer bytes). */
export const MIN_AUDIO_BYTES = 1500;

export function detectAudioFormat(bytes: Uint8Array): AudioFormat | null {
  if (bytes.length < 12) return null;
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  // EBML header used by WebM / Matroska (Chrome, Edge, Firefox recordings).
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "wav";
  // ISO base media (MP4 / M4A, Safari recordings): the "ftyp" box sits at offset 4.
  if (ascii(4, 4) === "ftyp") return "mp4";
  if (ascii(0, 3) === "ID3" || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)) return "mp3";
  return null;
}

export function mimeForAudioFormat(format: AudioFormat): string {
  switch (format) {
    case "webm":
      return "audio/webm";
    case "ogg":
      return "audio/ogg";
    case "mp4":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
  }
}
