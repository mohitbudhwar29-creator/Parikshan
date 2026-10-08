// Seeds the fictional demo patient, family profiles, records, medicines and the mock interaction dataset.
// Run with: npm run db:seed   (safe to re-run: the demo account is rebuilt from scratch)
import { resetDemoAccount } from "../lib/database/seed-demo";
import { prisma } from "../lib/database/prisma";

async function main(): Promise<void> {
  const userId = await resetDemoAccount();
  console.log(`Seeded demo account ${userId} with fictional profiles and records.`);
}

main()
  .catch((error: unknown) => {
    console.error("Seeding failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
