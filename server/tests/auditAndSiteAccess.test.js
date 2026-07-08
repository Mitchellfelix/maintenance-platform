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

describeIfDb("audit log and per-site operator access", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("records audit entries when sites are created", async () => {
    const { response } = await registerUser(app, { role: "ADMIN" });
    const token = response.body.token;

    const siteResponse = await createSite(app, token, { name: "Audited Site" });
    expect(siteResponse.response.status).toBe(201);

    const logs = await prisma.auditLog.findMany({ where: { action: "site.created" } });
    expect(logs).toHaveLength(1);
    expect(logs[0].entityId).toBe(siteResponse.response.body.id);
  });

  it("allows admin to read audit logs via API", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;

    await createSite(app, adminToken, { name: "Log Site" });

    const auditResponse = await request(app)
      .get("/api/audit-logs")
      .set(authHeader(adminToken));

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.length).toBeGreaterThanOrEqual(1);
    expect(auditResponse.body[0]).toHaveProperty("action");
    expect(auditResponse.body[0]).toHaveProperty("actor");
  });

  it("blocks non-admin from audit logs", async () => {
    const { response } = await registerUser(app, { role: "MANAGER" });
    const token = response.body.token;

    const auditResponse = await request(app)
      .get("/api/audit-logs")
      .set(authHeader(token));

    expect(auditResponse.status).toBe(403);
  });

  it("scopes operator site list to assigned sites", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;

    const siteA = await createSite(app, adminToken, { name: "Site A" });
    const siteB = await createSite(app, adminToken, { name: "Site B" });

    const { response: operatorResponse, payload } = await registerUser(app, { role: "MANAGER" });
    const operatorId = operatorResponse.body.user.id;
    const operatorToken = operatorResponse.body.token;

    await request(app)
      .put(`/api/users/${operatorId}/sites`)
      .set(authHeader(adminToken))
      .send({ siteIds: [siteA.response.body.id] });

    const sitesResponse = await request(app)
      .get("/api/sites")
      .set(authHeader(operatorToken));

    expect(sitesResponse.status).toBe(200);
    expect(sitesResponse.body).toHaveLength(1);
    expect(sitesResponse.body[0].name).toBe("Site A");

    const blockedResponse = await request(app)
      .get(`/api/sites/${siteB.response.body.id}`)
      .set(authHeader(operatorToken));

    expect(blockedResponse.status).toBe(404);
  });

  it("auto-grants site access when operator creates a site", async () => {
    const { response } = await registerUser(app, { role: "MANAGER" });
    const token = response.body.token;
    const userId = response.body.user.id;

    const siteResponse = await createSite(app, token, { name: "Operator Created" });
    expect(siteResponse.response.status).toBe(201);

    const access = await prisma.siteAccess.findMany({ where: { userId } });
    expect(access).toHaveLength(1);
    expect(access[0].siteId).toBe(siteResponse.response.body.id);
  });

  it("records audit when operator site access is updated", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;

    const site = await createSite(app, adminToken, { name: "Assignable Site" });
    const { response: operatorResponse } = await registerUser(app, { role: "MANAGER" });
    const operatorId = operatorResponse.body.user.id;

    const updateResponse = await request(app)
      .put(`/api/users/${operatorId}/sites`)
      .set(authHeader(adminToken))
      .send({ siteIds: [site.response.body.id] });

    expect(updateResponse.status).toBe(200);

    const logs = await prisma.auditLog.findMany({ where: { action: "site_access.updated" } });
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata.siteIds).toContain(site.response.body.id);
  });
});
