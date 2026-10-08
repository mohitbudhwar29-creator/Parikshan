import { deleteUserAccount } from "./users";
import { prisma } from "./prisma";
import { saveConfirmedRecord } from "./records";
import { DEMO_EMAIL, DEMO_ABHA, DEMO_INTERACTIONS, DEMO_PROFILES } from "./demo-data";

/** Keeps the mock interaction dataset in the database (idempotent). */
export async function seedInteractionDataset(): Promise<void> {
  for (const pair of DEMO_INTERACTIONS) {
    await prisma.drugInteraction.upsert({
      where: { medicineA_medicineB: { medicineA: pair.medicineA, medicineB: pair.medicineB } },
      create: { ...pair, severity: "potential", source: "mock-demo-dataset" },
      update: { description: pair.description, severity: "potential", source: "mock-demo-dataset" },
    });
  }
}

/**
 * Recreates the demo account from scratch: the user, three fictional profiles and their records.
 * Used by "Try Demo Patient" and by the setup script. Only the demo account is affected.
 */
export async function resetDemoAccount(): Promise<string> {
  await seedInteractionDataset();

  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  if (existing) await deleteUserAccount(existing.id);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo User",
      abhaNumber: DEMO_ABHA.replace(/-/g, ""),
      isDemo: true,
    },
  });

  for (const seed of DEMO_PROFILES) {
    const profile = await prisma.healthProfile.create({
      data: {
        userId: user.id,
        name: seed.name,
        relationship: seed.relationship,
        dateOfBirth: new Date(`${seed.dateOfBirth}T00:00:00.000Z`),
      },
    });
    for (const record of seed.records) {
      await saveConfirmedRecord({ profileId: profile.id, extracted: record, ocrProvider: "demo-seed" });
    }
  }
  return user.id;
}

/** Returns the id of the self profile for the demo user, used to pre-select it. */
export async function findDemoSelfProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.healthProfile.findFirst({ where: { userId, relationship: "SELF" }, select: { id: true } });
  return profile?.id ?? null;
}
