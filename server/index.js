const { createApp } = require("./src/app");
const prisma = require("./src/lib/prisma");
const { validateEnv, verifyDatabaseConnection } = require("./src/lib/startup");

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

let server;

async function start() {
  validateEnv();
  await verifyDatabaseConnection();

  server = app.listen(PORT, () => {
    console.log(`EMAT Tracking Database running on http://localhost:${PORT}`);
  });
}

async function shutdown() {
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error(err);
  } finally {
    if (server) {
      server.close(() => process.exit(0));
    } else {
      process.exit(0);
    }
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
