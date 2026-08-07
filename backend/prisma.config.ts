import "dotenv/config";
import { defineConfig } from "prisma/config";

// Used by the Prisma CLI only (migrate, db push, studio, introspect).
// Runtime queries go through the pg driver adapter in src/lib/prisma.js.
//
// DIRECT_URL is the unpooled connection. Supabase serves pooled traffic on
// port 6543 through pgbouncer, which cannot run the DDL that migrations need,
// so migrations must use the direct 5432 connection instead.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Left undefined when unset so `prisma generate` still works before the
    // Supabase credentials are filled in; migrate commands will ask for it.
    url: process.env.DIRECT_URL || undefined,
  },
});
