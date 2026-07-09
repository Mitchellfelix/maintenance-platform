#!/usr/bin/env node
/**
 * Reset a user's password by email.
 * Usage: node scripts/reset-password.js you@example.com "new-password"
 */
require("dotenv").config({ path: require("path").join(__dirname, "../server/.env") });

const bcrypt = require("bcrypt");
const prisma = require("../server/src/lib/prisma");

const SALT_ROUNDS = 10;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: node scripts/reset-password.js <email> "new-password"');
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
  });

  console.log(`Password updated for ${user.email}. Sign in with the new password.`);
}

main()
  .catch((err) => {
    if (err.code === "P2025") {
      console.error(`No user found with email ${process.argv[2]}`);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
