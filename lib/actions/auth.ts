"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { loginSchema } from "@/lib/validation/schemas";
import { upsertUserFromLogin, findUserById, deleteUserAccount } from "@/lib/database/users";
import { findDemoSelfProfileId, resetDemoAccount } from "@/lib/database/seed-demo";
import { DEMO_EMAIL } from "@/lib/database/demo-data";
import { PROFILE_COOKIE } from "@/lib/prefs/prefs";
import { clearSessionCookie, requireUserId, setSessionCookie } from "@/lib/auth/session";
import { fieldErrorsFrom, formString, type FieldErrors } from "./shared";

export interface LoginState {
  errorKey?: "login.errorInvalid" | "login.errorGeneric";
  fieldErrors?: FieldErrors;
}

/**
 * Demo sign-in with ABHA number (optional), name and email. No password or OTP: this is a prototype.
 * The ABHA number is stored locally and is never sent to an external service.
 */
export async function loginAction(_previous: LoginState | null, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    abhaNumber: formString(formData, "abhaNumber"),
    name: formString(formData, "name"),
    email: formString(formData, "email"),
  });
  if (!parsed.success) {
    return { errorKey: "login.errorInvalid", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  let userId: string;
  try {
    const user = await upsertUserFromLogin(parsed.data);
    userId = user.id;
  } catch {
    return { errorKey: "login.errorGeneric" };
  }
  await setSessionCookie(userId);
  (await cookies()).delete(PROFILE_COOKIE);
  redirect("/dashboard");
}

/** Recreates the fictional demo account with sample records, then opens it. */
export async function demoLoginAction(tour: boolean): Promise<void> {
  const userId = await resetDemoAccount();
  await setSessionCookie(userId);
  const selfProfileId = await findDemoSelfProfileId(userId);
  const store = await cookies();
  if (selfProfileId) store.set(PROFILE_COOKIE, selfProfileId, { path: "/", sameSite: "lax", httpOnly: true });
  redirect(tour ? "/dashboard?tour=1" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  (await cookies()).delete(PROFILE_COOKIE);
  redirect("/login");
}

const deleteSchema = z.object({ confirm: z.literal("on") });

export async function deleteAccountAction(_previous: { errorKey?: string } | null, formData: FormData) {
  const userId = await requireUserId();
  const parsed = deleteSchema.safeParse({ confirm: formString(formData, "confirm") });
  if (!parsed.success) return { errorKey: "error.actionFailed" as const };
  const user = await findUserById(userId);
  if (!user) redirect("/login");
  await deleteUserAccount(userId);
  await clearSessionCookie();
  (await cookies()).delete(PROFILE_COOKIE);
  redirect("/login?deleted=1");
}
