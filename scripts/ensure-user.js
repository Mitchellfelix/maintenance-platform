#!/usr/bin/env node
/**
 * Ensure a user exists. Never changes password/role/status if the email already exists.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/ensure-user.js email@company.com "password" "Name" ADMIN
 *   node scripts/ensure-user.js --local email@company.com "password" "Name" ADMIN
 *
 * Exit 0 if created or already present. Exit 1 on errors.
 */
const path = require("path");
const bcrypt = require("bcrypt");

const args = process.argv.slice(2);
const useLocal = args[0] === "--local";
if (useLocal) {
  require("dotenv").config({ path: path.join(__dirname, "../server/.env") });
  args.shift();
}

const email = args[0]?.trim().toLowerCase();
const password = args[1];
const name = args[2] || email?.split("@")[0] || "User";
const role = (args[3] || "TECHNICIAN").toUpperCase();

const ALLOWED_ROLES = new Set(["ADMIN", "OPS_LEAD", "TECHNICIAN", "VIEWER"]);

async function main() {
  if (!email || !password) {
    console.error(
      'Usage: node scripts/ensure-user.js [--local] <email> "<password>" [name] [role]',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters (only used when creating).");
    process.exit(1);
  }
  if (!ALLOWED_ROLES.has(role)) {
    console.error(`Role must be one of: ${[...ALLOWED_ROLES].join(", ")}`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (or pass --local).");
    process.exit(1);
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { email: true, role: true, status: true },
    });

    if (existing) {
      console.log(
        `EXISTS ${existing.email} role=${existing.role} status=${existing.status} (password unchanged)`,
      );
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role,
        status: "ACTIVE",
      },
      select: { email: true, role: true, status: true },
    });
    console.log(`CREATED ${created.email} role=${created.role} status=${created.status}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
