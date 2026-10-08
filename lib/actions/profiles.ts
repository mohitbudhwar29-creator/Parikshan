"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { idSchema, profileSchema } from "@/lib/validation/schemas";
import { createProfileForUser, findProfileForUser } from "@/lib/database/profiles";
import { requireUserId } from "@/lib/auth/session";
import { PROFILE_COOKIE } from "@/lib/prefs/prefs";
import { fieldErrorsFrom, formString, type FieldErrors } from "./shared";

export interface ProfileFormState {
  errorKey?: "error.actionFailed";
  fieldErrors?: FieldErrors;
}

const COOKIE_OPTIONS = { path: "/", sameSite: "lax" as const, httpOnly: true, maxAge: 60 * 60 * 24 * 365 };

/** Switches the active profile after checking the profile belongs to the signed-in user. */
export async function switchProfileAction(profileId: string): Promise<void> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(profileId);
  if (!id.success) redirect("/family");
  const profile = await findProfileForUser(userId, id.data);
  if (!profile) redirect("/family");
  (await cookies()).set(PROFILE_COOKIE, profile.id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function createProfileAction(_previous: ProfileFormState | null, formData: FormData): Promise<ProfileFormState> {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse({
    name: formString(formData, "name"),
    dateOfBirth: formString(formData, "dateOfBirth"),
    relationship: formString(formData, "relationship"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const profile = await createProfileForUser(userId, {
    name: parsed.data.name,
    dateOfBirth: parsed.data.dateOfBirth || null,
    relationship: parsed.data.relationship,
  });
  (await cookies()).set(PROFILE_COOKIE, profile.id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/family?added=1");
}
