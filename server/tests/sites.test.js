const request = require("supertest");
const prisma = require("../src/lib/prisma");
const { getApp, resetDatabase, registerUser } = require("./helpers");

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb("site routes", () => {
  let app;
  let token;

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
  });

  it("creates and lists sites", async () => {
    const createResponse = await request(app)
      .post("/api/sites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Plant A", address: "123 Main St" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe("Plant A");

    const listResponse = await request(app).get("/api/sites");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
  });

  it("returns 400 for invalid site payloads", async () => {
    const response = await request(app)
      .post("/api/sites")
      .set("Authorization", `Bearer ${token}`)
      .send({ address: "Missing name" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("blocks deleting a site with linked assets", async () => {
    const siteResponse = await request(app)
      .post("/api/sites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Plant B" });

    await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${token}`)
      .send({ siteId: siteResponse.body.id, name: "Pump 1" });

    const deleteResponse = await request(app)
      .delete(`/api/sites/${siteResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(409);
  });
});
