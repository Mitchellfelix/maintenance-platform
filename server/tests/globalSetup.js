const fs = require("fs");
const path = require("path");

const flagFile = path.join(__dirname, ".db-available");

module.exports = async () => {
  let available = false;

  if (process.env.DATABASE_URL) {
    try {
      const prisma = require("../src/lib/prisma");
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      available = true;
    } catch {
      available = false;
    }
  }

  fs.writeFileSync(flagFile, available ? "true" : "false");
};
