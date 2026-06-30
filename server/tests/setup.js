require("dotenv").config({ path: ".env.test" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";

const flagFile = path.join(__dirname, ".db-available");
if (fs.existsSync(flagFile)) {
  process.env.DB_TESTS_AVAILABLE = fs.readFileSync(flagFile, "utf8").trim();
} else {
  process.env.DB_TESTS_AVAILABLE = "false";
}

if (process.env.CI && process.env.DB_TESTS_AVAILABLE !== "true") {
  throw new Error("DATABASE_URL must be reachable when running tests in CI");
}
