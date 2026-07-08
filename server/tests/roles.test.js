const request = require("supertest");
const {
  describeIfDb,
  getApp,
  registerUser,
  setupDbHooks,
  authHeader,
} = require("./helpers");

describeIfDb("role-based access control", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("blocks REQUESTER from creating sites", async () => {
    const { response } = await registerUser(app, { role: "REQUESTER" });
    const token = response.body.token;

    const siteResponse = await request(app)
      .post("/api/sites")
      .set(authHeader(token))
      .send({ name: "Blocked Site" });

    expect(siteResponse.status).toBe(403);
    expect(siteResponse.body.error).toBe("Forbidden");
  });

  it("allows MANAGER (Operator) to create sites", async () => {
    const { response } = await registerUser(app, { role: "MANAGER" });
    const token = response.body.token;

    const siteResponse = await request(app)
      .post("/api/sites")
      .set(authHeader(token))
      .send({ name: "Operator Site" });

    expect(siteResponse.status).toBe(201);
  });

  it("allows ADMIN to list users and update roles", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;

    const { response: targetResponse } = await registerUser(app, { role: "REQUESTER" });
    const targetId = targetResponse.body.user.id;

    const listResponse = await request(app)
      .get("/api/users")
      .set(authHeader(adminToken));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.length).toBeGreaterThanOrEqual(2);

    const patchResponse = await request(app)
      .patch(`/api/users/${targetId}`)
      .set(authHeader(adminToken))
      .send({ role: "TECHNICIAN" });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.role).toBe("TECHNICIAN");
  });

  it("blocks non-admin from user management", async () => {
    const { response } = await registerUser(app, { role: "MANAGER" });
    const token = response.body.token;

    const usersResponse = await request(app).get("/api/users").set(authHeader(token));
    expect(usersResponse.status).toBe(403);
  });
});
