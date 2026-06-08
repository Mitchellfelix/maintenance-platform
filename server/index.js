const { createApp } = require("./src/app");
const prisma = require("./src/lib/prisma");

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Maintenance Platform running on http://localhost:${PORT}`);
});

async function shutdown() {
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error(err);
  } finally {
    server.close(() => process.exit(0));
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
