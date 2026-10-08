import type { User } from "@/lib/generated/prisma/client";
import { prisma } from "./prisma";
import { deleteStoredFile } from "@/lib/storage/uploads";
import type { LoginInput } from "@/lib/validation/schemas";

export async function findUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}

/**
 * Demo sign-in: creates the account on first use (with a self profile) or updates the name and
 * ABHA demo link on later sign-ins. There is no password or OTP, which is why this is demo-only.
 */
export async function upsertUserFromLogin(input: LoginInput): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        abhaNumber: input.abhaNumber ?? existing.abhaNumber,
      },
    });
  }
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      abhaNumber: input.abhaNumber,
      profiles: { create: { name: input.name, relationship: "SELF" } },
    },
  });
}

/** Deletes an account, all of its profiles and records, and then the uploaded files. */
export async function deleteUserAccount(userId: string): Promise<void> {
  const records = await prisma.healthRecord.findMany({
    where: { profile: { userId }, fileKey: { not: null } },
    select: { fileKey: true },
  });
  await prisma.user.delete({ where: { id: userId } });
  await Promise.all(records.map((record) => deleteStoredFile(record.fileKey)));
}
