const request = require("supertest");
const {
  describeIfDb,
  getApp,
  registerUser,
  setupDbHooks,
  authHeader,
} = require("./helpers");

describeIfDb("auth routes", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("registers a user and returns a token when tests activate the account", async () => {
    const { response } = await registerUser(app);

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toMatch(/@example.com$/);
    expect(response.body.user.password).toBeUndefined();
  });

  it("creates pending accounts that cannot sign in until approved", async () => {
    await registerUser(app, { role: "ADMIN" });

    const registerResponse = await request(app).post("/api/auth/register").send({
      email: "pending@example.com",
      password: "password123",
      name: "Pending User",
      requestedRole: "REQUESTER",
      reason: "Need access to the platform",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.pendingApproval).toBe(true);
    expect(registerResponse.body.token).toBeUndefined();

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "pending@example.com",
      password: "password123",
    });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.error).toMatch(/pending admin approval/i);
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
      .set(authHeader(registerResponse.body.token));

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(payload.email);
  });

  it("returns 401 without a token on protected routes", async () => {
    const response = await request(app).post("/api/sites").send({ name: "Plant A" });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("No token provided");
  });

  it("returns 401 for invalid login credentials", async () => {
    await registerUser(app);

    const response = await request(app).post("/api/auth/login").send({
      email: "missing@example.com",
      password: "wrongpassword",
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid credentials");
  });

  it("returns 409 for duplicate email registration", async () => {
    const { payload } = await registerUser(app);

    const response = await request(app).post("/api/auth/register").send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Duplicate value");
  });

  it("returns 400 for invalid registration payload", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("returns 401 for /api/auth/me without a token", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("No token provided");
  });

  it("returns 401 for /api/auth/me with an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set(authHeader("invalid-token"));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid token");
  });
});
