module.exports = async () => {
  const fs = require("fs");
  const path = require("path");
  const prisma = require("../src/lib/prisma");

  const flagFile = path.join(__dirname, ".db-available");
  if (fs.existsSync(flagFile)) {
    fs.unlinkSync(flagFile);
  }

  await prisma.$disconnect();
};
