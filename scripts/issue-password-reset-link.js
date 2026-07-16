#!/usr/bin/env node
/**
 * Create a one-time password-reset link without sending email (ops recovery).
 *
 * Usage:
 *   node scripts/issue-password-reset-link.js --railway you@example.com
 *   node scripts/issue-password-reset-link.js --local you@example.com
 */
const path = require("path");
const { execSync } = require("child_process");

const args = process.argv.slice(2);
let mode = "local";
if (args[0] === "--railway" || args[0] === "--local") {
  mode = args.shift().slice(2);
}

function resolveRailwayDatabaseUrl() {
  if (process.env.RAILWAY_DATABASE_URL) return process.env.RAILWAY_DATABASE_URL;
  try {
    const kv = execSync("railway variables --service Postgres --kv", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const key of ["DATABASE_PUBLIC_URL", "DATABASE_URL"]) {
      for (const line of kv.split("\n")) {
        if (!line.startsWith(`${key}=`)) continue;
        const value = line.slice(key.length + 1);
        if (key === "DATABASE_URL" && value.includes("railway.internal")) continue;
        return value;
      }
    }
  } catch {
    // fall through
  }
  return "";
}

if (mode === "local") {
  require("dotenv").config({ path: path.join(__dirname, "../server/.env") });
} else {
  const url = resolveRailwayDatabaseUrl();
  if (!url) {
    console.error("Could not resolve Railway DATABASE_URL. Set RAILWAY_DATABASE_URL=…");
    process.exit(1);
  }
  process.env.DATABASE_URL = url;
}

const { PrismaClient } = require("@prisma/client");
const { generateToken, hashToken } = require("../server/src/lib/tokens");

const prisma = new PrismaClient({ log: ["error"] });
const RESET_TTL_MS = 30 * 60 * 1000;

async function main() {
  const email = args[0]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/issue-password-reset-link.js [--railway|--local] <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    console.error(`No ACTIVE user found for ${email}`);
    process.exit(1);
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token: hashToken(token),
      expiresAt,
    },
  });

  const base =
    (process.env.EMAT_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  // Prefer public Railway app URL when issuing for railway mode.
  const appUrl =
    mode === "railway"
      ? (process.env.EMAT_APP_URL || process.env.APP_URL || "https://emat-production.up.railway.app").replace(
          /\/$/,
          "",
        )
      : base;

  console.log(`Reset link for ${email} (expires ${expiresAt.toISOString()}):`);
  console.log(`${appUrl}/reset-password/${token}`);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
