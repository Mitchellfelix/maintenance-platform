#!/usr/bin/env node
/**
 * Force-set a user's password (ops recovery when email reset is broken).
 * Always overwrites the password and sets status ACTIVE.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/reset-password.js you@example.com "new-password"
 *   node scripts/reset-password.js --railway you@example.com "new-password"
 *   node scripts/reset-password.js --local you@example.com "new-password"
 */
const path = require("path");
const { execSync } = require("child_process");
const bcrypt = require("bcrypt");

const args = process.argv.slice(2);
let mode = null;
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
} else if (mode === "railway") {
  const url = resolveRailwayDatabaseUrl();
  if (!url) {
    console.error("Could not resolve Railway DATABASE_URL. Set RAILWAY_DATABASE_URL=…");
    process.exit(1);
  }
  process.env.DATABASE_URL = url;
} else if (!process.env.DATABASE_URL) {
  require("dotenv").config({ path: path.join(__dirname, "../server/.env") });
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["error"] });
const SALT_ROUNDS = 10;

async function main() {
  const email = args[0]?.trim().toLowerCase();
  const password = args[1];

  if (!email || !password) {
    console.error('Usage: node scripts/reset-password.js [--railway|--local] <email> "new-password"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword, status: "ACTIVE" },
    select: { email: true, role: true, status: true },
  });

  console.log(`Password updated for ${user.email} (${user.role}/${user.status}). Sign in with the new password.`);
}

main()
  .catch((err) => {
    if (err.code === "P2025") {
      console.error(`No user found with email ${args[0]}`);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
