import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById } from "@/lib/database/users";
import { listProfilesForUser, resolveActiveProfile } from "@/lib/database/profiles";
import { getServerPrefs } from "@/lib/prefs/server";
import type { Prefs } from "@/lib/prefs/prefs";
import { PROFILE_COOKIE } from "@/lib/prefs/prefs";
import { getSessionUserId } from "./session";
import type { HealthProfile, User } from "@/lib/generated/prisma/client";
import type { ProfileWithCounts } from "@/lib/database/profiles";

export interface AppContext {
  user: User;
  profile: HealthProfile;
  profiles: ProfileWithCounts[];
  prefs: Prefs;
}

/**
 * Loads the signed-in user, the active profile (the one the user chose, otherwise their own) and preferences.
 * Redirects to sign-in when the session is missing or the account no longer exists.
 */
export async function requireAppContext(): Promise<AppContext> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const user = await findUserById(userId);
  if (!user) redirect("/login");
  const store = await cookies();
  const profile = await resolveActiveProfile(user.id, store.get(PROFILE_COOKIE)?.value);
  if (!profile) redirect("/family");
  const [profiles, prefs] = await Promise.all([listProfilesForUser(user.id), getServerPrefs()]);
  return { user, profile, profiles, prefs };
}

/** Same as requireAppContext but never redirects. Used by route handlers that return JSON errors instead. */
export async function getOptionalUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await findUserById(userId);
  return user?.id ?? null;
}
