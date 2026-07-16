#!/usr/bin/env node
/**
 * Print JSON counts for a DATABASE_URL (never prints connection details).
 * Usage: DATABASE_URL=... node scripts/db-counts.js
 *        node scripts/db-counts.js --local   (loads server/.env)
 */
const path = require("path");
const { PrismaClient } = require("@prisma/client");

if (process.argv.includes("--local")) {
  require("dotenv").config({ path: path.join(__dirname, "../server/.env") });
}

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(JSON.stringify({ error: "DATABASE_URL missing" }));
    process.exit(2);
  }

  const [users, sites, assets, workOrders] = await Promise.all([
    prisma.user.count(),
    prisma.site.count(),
    prisma.asset.count(),
    prisma.workOrder.count(),
  ]);

  process.stdout.write(JSON.stringify({ users, sites, assets, workOrders }) + "\n");
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ error: String(err.message || err).split("\n")[0] }));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
