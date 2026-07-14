const path = require("path");
const dotenv = require("dotenv");
const { assertSafeTestDatabaseUrl } = require("./assertSafeTestDatabaseUrl");

// Only load the dedicated test env for DATABASE_URL — never fall back to server/.env.
dotenv.config({ path: path.join(__dirname, "../.env.test") });

const fs = require("fs");

const flagFile = path.join(__dirname, ".db-available");

module.exports = async () => {
  let available = false;
  const check = assertSafeTestDatabaseUrl(process.env.DATABASE_URL, {
    source: "server/.env.test DATABASE_URL",
  });

  if (!check.ok) {
    console.warn(`[tests] Database tests skipped: ${check.reason}`);
    console.warn(
      "[tests] Copy server/.env.test.example → server/.env.test and create maintenance_platform_test.",
    );
  } else {
    try {
      // Ensure Prisma does not pick up server/.env over the test URL.
      process.env.DATABASE_URL = process.env.DATABASE_URL;
      const prisma = require("../src/lib/prisma");
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      available = true;
    } catch (err) {
      console.warn(`[tests] Database tests skipped: cannot connect (${err.message})`);
      available = false;
    }
  }

  fs.writeFileSync(flagFile, available ? "true" : "false");
};
