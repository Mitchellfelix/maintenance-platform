const request = require("supertest");
const { createApp } = require("../src/app");
const prisma = require("../src/lib/prisma");

const hasDatabase = process.env.DB_TESTS_AVAILABLE === "true";
const describeIfDb = hasDatabase ? describe : describe.skip;

function getApp() {
  return createApp();
}

async function resetDatabase() {
  await prisma.passwordReset.deleteMany();
  await prisma.userInvite.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.siteAccess.deleteMany();
  await prisma.workOrderNote.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.inventoryPart.deleteMany();
  await prisma.sopVersion.deleteMany();
  await prisma.sopDocument.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(app, overrides = {}) {
  const { role = "ADMIN", ...rest } = overrides;
  const payload = {
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: "password123",
    name: "Test User",
    ...rest,
  };

  const registerResponse = await request(app).post("/api/auth/register").send(payload);

  if (registerResponse.status !== 201) {
    return { response: registerResponse, payload };
  }

  await prisma.user.update({
    where: { email: payload.email },
    data: { role, status: "ACTIVE" },
  });

  const loginResponse = await request(app).post("/api/auth/login").send({
    email: payload.email,
    password: payload.password,
  });

  return {
    response: {
      status: loginResponse.status,
      body: loginResponse.body,
    },
    payload,
  };
}

async function createSite(app, token, overrides = {}) {
  const payload = { name: "Plant A", address: "123 Main St", ...overrides };
  const response = await request(app)
    .post("/api/sites")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);
  return { response, payload };
}

async function createAsset(app, token, siteId, overrides = {}) {
  const payload = { siteId, name: "Pump 1", ...overrides };
  const response = await request(app)
    .post("/api/assets")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);
  return { response, payload };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function setupDbHooks() {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });
}

module.exports = {
  describeIfDb,
  getApp,
  resetDatabase,
  registerUser,
  createSite,
  createAsset,
  authHeader,
  setupDbHooks,
};
