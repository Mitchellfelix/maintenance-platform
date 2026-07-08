#!/usr/bin/env node
/**
 * Promote a user to ADMIN by email.
 * Usage: node scripts/promote-admin.js you@example.com
 */
require("dotenv").config({ path: require("path").join(__dirname, "../server/.env") });

const prisma = require("../server/src/lib/prisma");

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/promote-admin.js <email>");
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`Promoted ${user.email} to ADMIN. Sign out and back in to refresh your session.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
