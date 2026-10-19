import { findUserById } from "@/lib/database/users";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

/** Reads the signed session cookie from a Request, the same check the pages use. Returns null when unsigned or expired. */
export function userIdFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName !== SESSION_COOKIE) continue;
    return readSessionToken(decodeURIComponent(rest.join("=")));
  }
  return null;
}

/** Full check for route handlers: a valid session whose account still exists. */
export async function authenticatedUserId(request: Request): Promise<string | null> {
  const userId = userIdFromRequest(request);
  if (!userId) return null;
  const user = await findUserById(userId);
  return user?.id ?? null;
}

/** Reads one cookie from a Request. Used to honour the same phc_profile selection the rest of the app uses. */
export function cookieFromRequest(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
