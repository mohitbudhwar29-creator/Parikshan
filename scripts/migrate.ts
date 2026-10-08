// Applies SQL migrations from prisma/migrations in order, recording each one in _prisma_migrations
// (the same table `prisma migrate deploy` uses). Safe to run repeatedly.
//
// Why a small runner: Prisma 7's migration engine is a native binary downloaded from binaries.prisma.sh.
// Where that download is blocked, this runner still applies the exact migration files. On a networked
// machine you can use `npx prisma migrate dev` instead; both read the same migration folders.
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/migrations");

export async function runMigrations(): Promise<string[]> {
  const client = createClient({ url: DATABASE_URL });
  const applied: string[] = [];
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    )`);

    const done = await client.execute(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    const doneNames = new Set(done.rows.map((row) => String(row.migration_name)));

    const folders = (await readdir(MIGRATIONS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const name of folders) {
      if (doneNames.has(name)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const id = randomUUID();
      await client.execute({
        sql: `INSERT INTO "_prisma_migrations" (id, checksum, migration_name) VALUES (?, ?, ?)`,
        args: [id, checksum, name],
      });
      await client.executeMultiple(sql);
      await client.execute({
        sql: `UPDATE "_prisma_migrations" SET finished_at = CURRENT_TIMESTAMP, applied_steps_count = 1 WHERE id = ?`,
        args: [id],
      });
      applied.push(name);
    }
  } finally {
    client.close();
  }
  return applied;
}

if (require.main === module || process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then((applied) => {
      console.log(applied.length > 0 ? `Applied migrations: ${applied.join(", ")}` : "Database is up to date.");
    })
    .catch((error: unknown) => {
      console.error("Migration failed:", error instanceof Error ? error.message : "unknown error");
      process.exitCode = 1;
    });
}
