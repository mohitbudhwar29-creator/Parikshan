import type { HealthProfile } from "@/lib/generated/prisma/client";
import { prisma } from "./prisma";
import type { Relationship } from "@/types/health";

export type ProfileWithCounts = HealthProfile & { _count: { records: number } };

/** Lists profiles owned by a user. The self profile always comes first. */
export async function listProfilesForUser(userId: string): Promise<ProfileWithCounts[]> {
  const profiles = await prisma.healthProfile.findMany({
    where: { userId },
    include: { _count: { select: { records: true } } },
    orderBy: { createdAt: "asc" },
  });
  return profiles.sort((a, b) => Number(b.relationship === "SELF") - Number(a.relationship === "SELF"));
}

/** Ownership check: returns the profile only if it belongs to the user. */
export async function findProfileForUser(userId: string, profileId: string): Promise<HealthProfile | null> {
  return prisma.healthProfile.findFirst({ where: { id: profileId, userId } });
}

/**
 * Chooses the profile to show: the requested one when it belongs to the user, otherwise the self profile,
 * otherwise the first profile. Never returns a profile the user does not own.
 */
export async function resolveActiveProfile(userId: string, requestedProfileId?: string | null): Promise<HealthProfile | null> {
  if (requestedProfileId) {
    const requested = await findProfileForUser(userId, requestedProfileId);
    if (requested) return requested;
  }
  const profiles = await prisma.healthProfile.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return profiles.find((profile) => profile.relationship === "SELF") ?? profiles[0] ?? null;
}

export interface NewProfileInput {
  name: string;
  dateOfBirth?: string | null;
  relationship: Relationship;
}

export async function createProfileForUser(userId: string, input: NewProfileInput): Promise<HealthProfile> {
  return prisma.healthProfile.create({
    data: {
      userId,
      name: input.name,
      relationship: input.relationship,
      dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
    },
  });
}
