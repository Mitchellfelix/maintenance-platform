const request = require("supertest");
const prisma = require("../src/lib/prisma");
const { getApp, resetDatabase, registerUser } = require("./helpers");

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb("auth routes", () => {
  let app;

  beforeAll(async () => {
    app = getApp();
    await prisma.$connect();
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("registers a user and returns a token", async () => {
    const { response } = await registerUser(app);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toMatch(/@example.com$/);
    expect(response.body.user.password).toBeUndefined();
  });

  it("logs in with valid credentials", async () => {
    const { payload } = await registerUser(app);

    const response = await request(app).post("/api/auth/login").send({
      email: payload.email,
      password: payload.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
  });

  it("returns the current user for /api/auth/me", async () => {
    const { response: registerResponse, payload } = await registerUser(app);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registerResponse.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(payload.email);
  });

  it("returns 401 without a token on protected routes", async () => {
    const response = await request(app).post("/api/sites").send({ name: "Plant A" });
    expect(response.status).toBe(401);
  });
});
