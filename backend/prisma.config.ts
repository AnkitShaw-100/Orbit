import "dotenv/config";
import { defineConfig } from "prisma/config";

// Used by the Prisma CLI only (migrate, db push, studio, introspect).
// Runtime queries go through the pg driver adapter in src/lib/prisma.js.
//
// DIRECT_URL is the unpooled connection. Supabase serves pooled traffic on
// port 6543 through pgbouncer, which cannot run the DDL or advisory locks that
// migrations need, so migrations prefer the direct 5432 connection. Falling
// back to DATABASE_URL covers hosts where only one connection string is set.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

// `prisma generate` runs during install, long before any database credentials
// exist, and must not fail. Only the commands that actually talk to the
// database are worth stopping — and when they stop, they should say which
// variable is missing rather than leaving you to guess.
const needsDatabase = process.argv.some((arg) => arg === "migrate" || arg === "db");

if (!url && needsDatabase) {
  throw new Error(
    "No database connection string. Set DIRECT_URL (Supabase's direct connection, port 5432) " +
      "or at least DATABASE_URL in this environment. On Railway or Render these go in the " +
      "service's Variables tab — a value in your local .env is not visible to the container.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
