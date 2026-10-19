import type { VoiceErrorKey } from "./types";
import { voiceErrorStatus } from "./config";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function voiceJson<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status, headers: NO_STORE });
}

export function voiceError(errorKey: VoiceErrorKey, extra: Record<string, unknown> = {}): Response {
  return Response.json({ ok: false, errorKey, ...extra }, { status: voiceErrorStatus(errorKey), headers: NO_STORE });
}
