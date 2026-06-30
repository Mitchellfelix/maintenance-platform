const request = require("supertest");
const { getApp } = require("./helpers");

describe("health routes", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  it("returns ok for liveness check", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("maintenance-platform");
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb("health routes with database", () => {
  let app;
  const prisma = require("../src/lib/prisma");

  beforeAll(async () => {
    app = getApp();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns ok when database is reachable", async () => {
    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database).toBe("up");
  });
});
