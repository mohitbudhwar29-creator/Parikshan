import { prisma } from "./prisma";

export async function listInteractionPairs() {
  return prisma.drugInteraction.findMany({ orderBy: [{ medicineA: "asc" }, { medicineB: "asc" }] });
}
