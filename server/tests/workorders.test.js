const request = require("supertest");
const prisma = require("../src/lib/prisma");
const { getApp, resetDatabase, registerUser } = require("./helpers");

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb("work order routes", () => {
  let app;
  let token;
  let siteId;

  beforeAll(async () => {
    app = getApp();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
    const { response } = await registerUser(app);
    token = response.body.token;

    const siteResponse = await request(app)
      .post("/api/sites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Plant A", address: "123 Main St" });

    siteId = siteResponse.body.id;
  });

  it("creates a work order with an auto-generated code", async () => {
    const response = await request(app)
      .post("/api/workorders")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Fix pump", siteId });

    expect(response.status).toBe(201);
    expect(response.body.code).toMatch(/^WO-\d{4}-\d{5}$/);
    expect(response.body.title).toBe("Fix pump");
  });

  it("generates unique codes under concurrent creation", async () => {
    const payload = { title: "Concurrent job", siteId };
    const requests = Array.from({ length: 5 }, () =>
      request(app)
        .post("/api/workorders")
        .set("Authorization", `Bearer ${token}`)
        .send(payload),
    );

    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(201);
      expect(response.body.code).toMatch(/^WO-\d{4}-\d{5}$/);
    }

    const codes = responses.map((response) => response.body.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
