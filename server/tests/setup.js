require("dotenv").config({ path: ".env.test" });
require("dotenv").config();

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";

if (process.env.CI && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set when running tests in CI");
}
