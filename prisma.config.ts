import { defineConfig } from "prisma/config";

// Prisma 7 config. Runtime access uses the libsql driver adapter (see lib/database/prisma.ts),
// so no native query engine download is required.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
