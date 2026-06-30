const prisma = require("./prisma");

const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

async function verifyDatabaseConnection() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
}

module.exports = { validateEnv, verifyDatabaseConnection };
