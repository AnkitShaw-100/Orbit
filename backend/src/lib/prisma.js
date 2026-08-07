const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

// Prisma 7 takes the connection through a driver adapter rather than a `url`
// in schema.prisma. DATABASE_URL is the pooled Supabase connection; migrations
// use DIRECT_URL instead (see prisma.config.ts).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;
