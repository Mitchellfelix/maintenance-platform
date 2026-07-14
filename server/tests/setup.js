const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { assertSafeTestDatabaseUrl } = require("./assertSafeTestDatabaseUrl");

// Dedicated test env only — do not load server/.env (that is the live app DB).
dotenv.config({ path: path.join(__dirname, "../.env.test") });

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";

const flagFile = path.join(__dirname, ".db-available");
const safety = assertSafeTestDatabaseUrl(process.env.DATABASE_URL, {
  source: "server/.env.test DATABASE_URL",
});

if (!safety.ok) {
  process.env.DB_TESTS_AVAILABLE = "false";
  if (process.env.CI) {
    throw new Error(`Unsafe or missing test database: ${safety.reason}`);
  }
} else if (fs.existsSync(flagFile)) {
  process.env.DB_TESTS_AVAILABLE = fs.readFileSync(flagFile, "utf8").trim();
} else {
  process.env.DB_TESTS_AVAILABLE = "false";
}

if (process.env.CI && process.env.DB_TESTS_AVAILABLE !== "true") {
  throw new Error("DATABASE_URL must be reachable when running tests in CI");
}

// Double-check in every worker: never wipe a live DB even if flags are wrong.
if (process.env.DB_TESTS_AVAILABLE === "true") {
  const again = assertSafeTestDatabaseUrl(process.env.DATABASE_URL);
  if (!again.ok) {
    throw new Error(`Refusing to run DB tests: ${again.reason}`);
  }
}
