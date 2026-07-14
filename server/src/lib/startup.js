const prisma = require("./prisma");

const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"];
const WEAK_JWT_SECRETS = new Set([
  "change-me-in-production",
  "secret",
  "jwt-secret",
  "dev",
  "development",
  "test",
]);

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const secret = process.env.JWT_SECRET || "";
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    if (!process.env.EMAT_APP_URL && !process.env.APP_URL) {
      throw new Error("Missing required environment variables: EMAT_APP_URL or APP_URL");
    }
    if (secret.length < 32 || WEAK_JWT_SECRETS.has(secret)) {
      throw new Error(
        "JWT_SECRET must be at least 32 characters and must not be a default placeholder in production",
      );
    }
  } else if (WEAK_JWT_SECRETS.has(secret)) {
    console.warn(
      "[startup] JWT_SECRET is a weak placeholder — set a strong secret before any shared/team deploy",
    );
  }
}

async function verifyDatabaseConnection() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
}

module.exports = { validateEnv, verifyDatabaseConnection };
