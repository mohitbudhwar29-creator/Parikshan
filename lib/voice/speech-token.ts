import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The speak endpoint only reads text that this server produced for the same signed-in user.
// Without this, any signed-in user could send arbitrary text to a paid speech provider.
const TOKEN_TTL_MS = 15 * 60 * 1000;

function secret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) return `voice:${configured}`;
  return "voice:dev-only-insecure-secret";
}

function digest(userId: string, expiresAt: number, text: string): string {
  const textHash = createHash("sha256").update(text, "utf8").digest("hex");
  return createHmac("sha256", secret()).update(`${userId}.${expiresAt}.${textHash}`).digest("base64url");
}

export function createSpeechToken(userId: string, text: string, now: number = Date.now()): string {
  const expiresAt = now + TOKEN_TTL_MS;
  return `${expiresAt}.${digest(userId, expiresAt, text)}`;
}

export function verifySpeechToken(userId: string, text: string, token: string, now: number = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt < now || expiresAt > now + TOKEN_TTL_MS) return false;
  const expected = Buffer.from(digest(userId, expiresAt, text));
  const given = Buffer.from(parts[1] ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
