#!/usr/bin/env node
/**
 * Fail closed for destructive Prisma shortcuts against the live DB.
 * Use only with EMAT_ALLOW_DESTROY_DATA=YES and a *_test DATABASE_URL.
 */
const forbidden = process.argv[2] || "destructive command";

if (process.env.EMAT_ALLOW_DESTROY_DATA !== "YES") {
  console.error(
    `\nRefusing \`${forbidden}\`.\n` +
      `This project treats your database as durable production data.\n` +
      `Allowed safely: npm run db:backup | npm run db:deploy:safe | npm run db:restore\n` +
      `To force anyway (test DBs only): EMAT_ALLOW_DESTROY_DATA=YES …\n`,
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL || "";
let dbName = "";
try {
  dbName = new URL(url).pathname.replace(/^\//, "").split("/")[0] || "";
} catch {
  dbName = "";
}

if (!dbName || !/_test$/i.test(dbName) || dbName === "maintenance_platform") {
  console.error(
    `\nRefusing \`${forbidden}\` even with EMAT_ALLOW_DESTROY_DATA=YES.\n` +
      `DATABASE_URL must point at a dedicated database whose name ends with _test.\n` +
      `Got: ${dbName || "(missing)"}\n`,
  );
  process.exit(1);
}

process.exit(0);
