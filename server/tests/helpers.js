const { createApp } = require("../src/app");
const prisma = require("../src/lib/prisma");

function getApp() {
  return createApp();
}

async function resetDatabase() {
  await prisma.workOrderNote.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(app, overrides = {}) {
  const payload = {
    email: `user-${Date.now()}@example.com`,
    password: "password123",
    name: "Test User",
    ...overrides,
  };

  const response = await app.post("/api/auth/register").send(payload);
  return { response, payload };
}

module.exports = { getApp, resetDatabase, registerUser };
