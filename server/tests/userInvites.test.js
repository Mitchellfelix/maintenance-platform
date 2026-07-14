const request = require("supertest");
const prisma = require("../src/lib/prisma");
const {
  describeIfDb,
  getApp,
  registerUser,
  createSite,
  setupDbHooks,
  authHeader,
} = require("./helpers");

describeIfDb("admin user create and invites", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("lets an admin create an active user with a temporary password", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;
    const site = await createSite(app, adminToken, { name: "Create Plant" });

    const createResponse = await request(app)
      .post("/api/users")
      .set(authHeader(adminToken))
      .send({
        email: "created@example.com",
        name: "Created User",
        role: "OPERATOR",
        siteIds: [site.response.body.id],
        sendCredentials: false,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.user.email).toBe("created@example.com");
    expect(createResponse.body.user.status).toBe("ACTIVE");
    expect(createResponse.body.temporaryPassword).toBeTruthy();

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "created@example.com",
      password: createResponse.body.temporaryPassword,
    });
    expect(loginResponse.status).toBe(200);
  });

  it("lets an admin invite a user and accept the invite", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;

    const inviteResponse = await request(app)
      .post("/api/users/invites")
      .set(authHeader(adminToken))
      .send({
        email: "invited@example.com",
        name: "Invited User",
        role: "REQUESTER",
      });

    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body.invite.inviteUrl).toContain("/invite/");

    const token = inviteResponse.body.invite.inviteUrl.split("/invite/")[1];
    const preview = await request(app).get(`/api/auth/invites/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.email).toBe("invited@example.com");

    const acceptResponse = await request(app)
      .post(`/api/auth/invites/${token}/accept`)
      .send({ password: "password123", name: "Invited User" });

    expect(acceptResponse.status).toBe(201);
    expect(acceptResponse.body.user.email).toBe("invited@example.com");
    expect(acceptResponse.body.token).toBeTruthy();

    const reused = await request(app)
      .post(`/api/auth/invites/${token}/accept`)
      .send({ password: "password123" });
    expect(reused.status).toBe(410);
  });

  it("blocks non-admins from creating users", async () => {
    const { response: opsResponse } = await registerUser(app, { role: "OPS_LEAD" });
    const createResponse = await request(app)
      .post("/api/users")
      .set(authHeader(opsResponse.body.token))
      .send({
        email: "blocked@example.com",
        role: "REQUESTER",
      });
    expect(createResponse.status).toBe(403);
  });
});
