import { cookies } from "next/headers";
import { PREFS_COOKIE, parsePrefs, type Prefs } from "./prefs";

/** Reads the user's preferences from the cookie on the server (language, accessibility). */
export async function getServerPrefs(): Promise<Prefs> {
  const store = await cookies();
  return parsePrefs(store.get(PREFS_COOKIE)?.value);
}
