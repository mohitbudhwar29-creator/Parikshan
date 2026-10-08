import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Demo session: a signed, httpOnly cookie carrying only the user id and issue time.
// There is no password. Official ABHA authentication would replace the sign-in step, not this cookie.
export const SESSION_COOKIE = "phc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function signingSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 16 characters in production.");
  }
  return "dev-only-insecure-session-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, issuedAt: number = Date.now()): string {
  const payload = `${userId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id when the token is authentic and not expired; otherwise null. */
export function readSessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedRaw, signature] = parts as [string, string, string];
  if (!USER_ID_PATTERN.test(userId)) return null;
  const issuedAt = Number(issuedRaw);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return null;
  const expected = Buffer.from(sign(`${userId}.${issuedRaw}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** For pages and server actions: redirects to the sign-in page when there is no valid session. */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
