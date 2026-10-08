// Runs before `npm run dev`: applies migrations and seeds the demo account if it does not exist yet.
import { runMigrations } from "./migrate";
import { prisma } from "../lib/database/prisma";
import { DEMO_EMAIL } from "../lib/database/demo-data";
import { resetDemoAccount, seedInteractionDataset } from "../lib/database/seed-demo";

async function main(): Promise<void> {
  const applied = await runMigrations();
  if (applied.length > 0) console.log(`[setup] Applied migrations: ${applied.join(", ")}`);

  const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  if (demo) {
    await seedInteractionDataset();
    console.log("[setup] Demo data already present.");
  } else {
    await resetDemoAccount();
    console.log("[setup] Seeded fictional demo data (demo patient, family profiles, records, medicines).");
  }
}

main()
  .catch((error: unknown) => {
    console.error("[setup] Database setup failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
