#!/usr/bin/env node
/**
 * Non-destructive copy of User rows from local DB → Railway.
 * Existing Railway emails are left alone (password/role/status unchanged).
 *
 * Usage:
 *   RAILWAY_DATABASE_URL='postgresql://…' node scripts/sync-users-to-railway.js
 *   (or linked CLI; script resolves public Postgres URL)
 */
const path = require("path");
const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

function resolveRailwayDatabaseUrl() {
  if (process.env.RAILWAY_DATABASE_URL) return process.env.RAILWAY_DATABASE_URL;
  if (process.env.DATABASE_URL_RAILWAY) return process.env.DATABASE_URL_RAILWAY;

  try {
    const kv = execSync("railway variables --service Postgres --kv", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const line of kv.split("\n")) {
      if (line.startsWith("DATABASE_PUBLIC_URL=")) return line.slice("DATABASE_PUBLIC_URL=".length);
      if (line.startsWith("DATABASE_URL=") && !line.includes("railway.internal")) {
        return line.slice("DATABASE_URL=".length);
      }
    }
    for (const line of kv.split("\n")) {
      if (line.startsWith("DATABASE_URL=")) return line.slice("DATABASE_URL=".length);
    }
  } catch {
    // fall through
  }
  return "";
}

async function main() {
  const localUrl = process.env.DATABASE_URL;
  const remoteUrl = resolveRailwayDatabaseUrl();

  if (!localUrl) {
    console.error("Local DATABASE_URL missing (server/.env).");
    process.exit(1);
  }
  if (!remoteUrl) {
    console.error("Could not resolve Railway DATABASE_URL. Set RAILWAY_DATABASE_URL=…");
    process.exit(1);
  }
  if (remoteUrl.includes("railway.internal")) {
    console.error("Railway URL is internal-only; set RAILWAY_DATABASE_URL to the public URL.");
    process.exit(1);
  }

  const local = new PrismaClient({
    datasources: { db: { url: localUrl } },
    log: ["error"],
  });
  const remote = new PrismaClient({
    datasources: { db: { url: remoteUrl } },
    log: ["error"],
  });

  try {
    const users = await local.user.findMany({
      select: {
        email: true,
        password: true,
        name: true,
        role: true,
        status: true,
      },
    });

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      const existing = await remote.user.findUnique({
        where: { email: user.email },
        select: { email: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await remote.user.create({
        data: {
          email: user.email,
          password: user.password,
          name: user.name,
          role: user.role,
          status: user.status,
        },
      });
      created += 1;
    }

    console.log(`sync-users: created=${created} skipped_existing=${skipped} local_total=${users.length}`);
    console.log("Existing Railway accounts were not modified.");
  } finally {
    await local.$disconnect();
    await remote.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
