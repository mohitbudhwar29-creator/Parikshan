import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/lib/generated/prisma/client";

// One Prisma client per server process (hot reload safe in development).
// Access goes through the libsql driver adapter so the same code runs on SQLite today and
// can switch to Postgres/managed SQL by changing the adapter and datasource provider.
const globalForPrisma = globalThis as unknown as { __phcPrisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.__phcPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__phcPrisma = prisma;
}
