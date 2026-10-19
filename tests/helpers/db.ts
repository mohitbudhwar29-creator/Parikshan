import { runMigrations } from "../../scripts/migrate";
import { prisma } from "@/lib/database/prisma";
import { DEMO_EMAIL } from "@/lib/database/demo-data";
import { resetDemoAccount } from "@/lib/database/seed-demo";
import { createSessionToken } from "@/lib/auth/session";

let ready: Promise<void> | null = null;

/** Applies migrations and seeds the fictional demo account once per test process. */
export function ensureTestDatabase(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await runMigrations();
      const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
      if (!demo) await resetDemoAccount();
    })();
  }
  return ready;
}

export async function demoUserAndSelfProfile() {
  await ensureTestDatabase();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
  const profile = await prisma.healthProfile.findFirstOrThrow({ where: { userId: user.id, relationship: "SELF" } });
  return { user, profile };
}

/** Creates an independent account with one saved record, so authorization tests have a victim. */
export async function createOtherAccount(tag: string, hemoglobin = "7.1") {
  await ensureTestDatabase();
  const user = await prisma.user.create({ data: { email: `${tag}-${Date.now()}@example.test`, name: `Other ${tag}` } });
  const profile = await prisma.healthProfile.create({
    data: { userId: user.id, name: `Other ${tag} (self)`, relationship: "SELF" },
  });
  const record = await prisma.healthRecord.create({
    data: {
      profileId: profile.id,
      type: "LAB_REPORT",
      status: "SAVED",
      title: `Secret blood test ${tag}`,
      recordDate: new Date("2026-03-03T00:00:00.000Z"),
      labResults: {
        create: [
          {
            testName: "Haemoglobin (Hb)",
            value: hemoglobin,
            numericValue: Number(hemoglobin),
            unit: "g/dL",
            referenceRange: "12.0 - 16.0",
            flag: "LOW",
            metricName: "hemoglobin",
            date: new Date("2026-03-03T00:00:00.000Z"),
          },
        ],
      },
    },
  });
  // The assistant's trend answers read HealthMetric rows, which the upload path writes alongside labs.
  await prisma.healthMetric.create({
    data: {
      profileId: profile.id,
      metricName: "hemoglobin",
      value: Number(hemoglobin),
      unit: "g/dL",
      recordedAt: new Date("2026-03-03T00:00:00.000Z"),
      sourceRecordId: record.id,
      referenceLow: 12,
      referenceHigh: 16,
    },
  });
  return { user, profile, record };
}

/** A signed session cookie header for a user id, exactly as the browser would send it. */
export function cookieFor(userId: string): string {
  return `phc_session=${createSessionToken(userId)}`;
}

export async function cleanupOtherAccounts(userIds: string[]) {
  for (const id of userIds) await prisma.user.delete({ where: { id } }).catch(() => undefined);
}

export async function countHealthRecordsForUser(userId: string): Promise<number> {
  return prisma.healthRecord.count({ where: { profile: { userId } } });
}
