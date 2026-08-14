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

describeIfDb("access requests", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("activates pending accounts when an admin approves the signup request", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;
    const site = await createSite(app, adminToken, { name: "Main Plant" });

    const registerResponse = await request(app).post("/api/auth/register").send({
      email: "newhire@example.com",
      password: "password123",
      name: "New Hire",
      requestedRole: "OPERATOR",
      requestedSiteIds: [site.response.body.id],
      reason: "Joining the maintenance team",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.pendingApproval).toBe(true);

    const pendingRequest = await prisma.accessRequest.findFirst({
      where: { requester: { email: "newhire@example.com" }, status: "PENDING" },
    });
    expect(pendingRequest).toBeTruthy();

    const { response: secondAdminResponse } = await registerUser(app, { role: "ADMIN" });
    const secondAdminToken = secondAdminResponse.body.token;

    const approveResponse = await request(app)
      .patch(`/api/access-requests/${pendingRequest.id}/approve`)
      .set(authHeader(secondAdminToken))
      .send({ reviewNote: "Welcome aboard" });

    expect(approveResponse.status).toBe(200);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "newhire@example.com",
      password: "password123",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.role).toBe("OPERATOR");
    expect(loginResponse.body.user.status).toBe("ACTIVE");
  });

  it("lets admins review and approve ops lead requests with site access", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;

    const site = await createSite(app, adminToken, { name: "North Plant" });

    const { response: requesterResponse } = await registerUser(app, { role: "REQUESTER" });
    const requesterToken = requesterResponse.body.token;
    const requesterId = requesterResponse.body.user.id;

    const createResponse = await request(app)
      .post("/api/access-requests")
      .set(authHeader(requesterToken))
      .send({
        requestedRole: "OPS_LEAD",
        requestedSiteIds: [site.response.body.id],
        reason: "Managing north plant operations",
      });

    expect(createResponse.status).toBe(201);
    const requestId = createResponse.body.id;

    const approveResponse = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(adminToken))
      .send({ reviewNote: "Approved for north plant" });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.status).toBe("APPROVED");

    const updatedUser = await prisma.user.findUnique({ where: { id: requesterId } });
    expect(updatedUser.role).toBe("OPS_LEAD");

    const siteAccess = await prisma.siteAccess.findMany({ where: { userId: requesterId } });
    expect(siteAccess).toHaveLength(1);
    expect(siteAccess[0].siteId).toBe(site.response.body.id);
  });

  it("lets admins reject requests without changing roles", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;

    const site = await createSite(app, adminToken, { name: "South Plant" });

    const { response: requesterResponse } = await registerUser(app, { role: "REQUESTER" });
    const requesterToken = requesterResponse.body.token;
    const requesterId = requesterResponse.body.user.id;

    const createResponse = await request(app)
      .post("/api/access-requests")
      .set(authHeader(requesterToken))
      .send({
        requestedRole: "OPERATOR",
        requestedSiteIds: [site.response.body.id],
      });

    const rejectResponse = await request(app)
      .patch(`/api/access-requests/${createResponse.body.id}/reject`)
      .set(authHeader(adminToken))
      .send({ reviewNote: "Not approved yet" });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.status).toBe("REJECTED");

    const updatedUser = await prisma.user.findUnique({ where: { id: requesterId } });
    expect(updatedUser.role).toBe("REQUESTER");
  });

  it("auto-assigns all org sites when approve sends an empty site list", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;
    const site = await createSite(app, adminToken, { name: "East Plant" });

    const { response: requesterResponse } = await registerUser(app, { role: "REQUESTER" });
    const requesterToken = requesterResponse.body.token;
    const requesterId = requesterResponse.body.user.id;

    const createResponse = await request(app)
      .post("/api/access-requests")
      .set(authHeader(requesterToken))
      .send({
        requestedRole: "OPERATOR",
        requestedSiteIds: [site.response.body.id],
      });

    const approveResponse = await request(app)
      .patch(`/api/access-requests/${createResponse.body.id}/approve`)
      .set(authHeader(adminToken))
      .send({ requestedSiteIds: [] });

    expect(approveResponse.status).toBe(200);
    const siteAccess = await prisma.siteAccess.findMany({ where: { userId: requesterId } });
    expect(siteAccess.map((row) => row.siteId)).toEqual([site.response.body.id]);
  });

  it("auto-assigns all org sites when approving a site-scoped role with no site payload", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;
    const siteA = await createSite(app, adminToken, { name: "Central Plant" });
    const siteB = await createSite(app, adminToken, { name: "Dock Plant" });

    const { response: requesterResponse } = await registerUser(app, { role: "REQUESTER" });
    const requesterToken = requesterResponse.body.token;
    const requesterId = requesterResponse.body.user.id;

    const createResponse = await request(app)
      .post("/api/access-requests")
      .set(authHeader(requesterToken))
      .send({
        requestedRole: "OPERATOR",
      });

    const approveResponse = await request(app)
      .patch(`/api/access-requests/${createResponse.body.id}/approve`)
      .set(authHeader(adminToken))
      .send({ requestedRole: "OPS_LEAD" });

    expect(approveResponse.status).toBe(200);
    const siteAccess = await prisma.siteAccess.findMany({ where: { userId: requesterId } });
    expect(siteAccess).toHaveLength(2);
    expect(siteAccess.map((row) => row.siteId).sort()).toEqual(
      [siteA.response.body.id, siteB.response.body.id].sort(),
    );
  });

  it("blocks operators from reviewing requests", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;
    const site = await createSite(app, adminToken, { name: "West Plant" });

    const { response: requesterResponse } = await registerUser(app, { role: "REQUESTER" });
    const requesterToken = requesterResponse.body.token;

    const createResponse = await request(app)
      .post("/api/access-requests")
      .set(authHeader(requesterToken))
      .send({
        requestedRole: "OPERATOR",
        requestedSiteIds: [site.response.body.id],
      });

    const reviewResponse = await request(app)
      .patch(`/api/access-requests/${createResponse.body.id}/approve`)
      .set(authHeader(requesterToken));

    expect(reviewResponse.status).toBe(403);
  });

  it("lets ops leads approve access requests", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;
    const site = await createSite(app, adminToken, { name: "Harbor Plant" });

    const { response: opsLeadResponse } = await registerUser(app, { role: "OPS_LEAD" });
    const opsLeadToken = opsLeadResponse.body.token;

    const { response: requesterResponse } = await registerUser(app, { role: "REQUESTER" });
    const requesterToken = requesterResponse.body.token;
    const requesterId = requesterResponse.body.user.id;

    const createResponse = await request(app)
      .post("/api/access-requests")
      .set(authHeader(requesterToken))
      .send({
        requestedRole: "OPERATOR",
        requestedSiteIds: [site.response.body.id],
        reason: "Ops lead approval path",
      });

    expect(createResponse.status).toBe(201);

    const approveResponse = await request(app)
      .patch(`/api/access-requests/${createResponse.body.id}/approve`)
      .set(authHeader(opsLeadToken))
      .send({ reviewNote: "Approved by Ops Lead" });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.status).toBe("APPROVED");

    const updatedUser = await prisma.user.findUnique({ where: { id: requesterId } });
    expect(updatedUser.role).toBe("OPERATOR");
    expect(updatedUser.status).toBe("ACTIVE");
  });
});
