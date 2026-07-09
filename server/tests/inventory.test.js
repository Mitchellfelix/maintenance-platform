const request = require("supertest");
const {
  describeIfDb,
  getApp,
  registerUser,
  createSite,
  createAsset,
  setupDbHooks,
  authHeader,
} = require("./helpers");

describeIfDb("inventory routes", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("creates and lists inventory parts for a unit", async () => {
    const { response } = await registerUser(app, { role: "OPS_LEAD" });
    const token = response.body.token;

    const site = await createSite(app, token, { name: "Warehouse" });
    const asset = await createAsset(app, token, site.response.body.id, { name: "Unit 42" });

    const createResponse = await request(app)
      .post("/api/inventory")
      .set(authHeader(token))
      .send({
        assetId: asset.response.body.id,
        partNumber: "PN-1001",
        location: "Bin A3",
        description: "Replacement filter",
        quantity: 2,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.partNumber).toBe("PN-1001");
    expect(createResponse.body.location).toBe("Bin A3");
    expect(createResponse.body.asset.name).toBe("Unit 42");

    const listResponse = await request(app).get("/api/inventory").set(authHeader(token));
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
  });

  it("blocks requesters from adding inventory", async () => {
    const { response: adminResponse } = await registerUser(app, { role: "ADMIN" });
    const adminToken = adminResponse.body.token;
    const site = await createSite(app, adminToken);
    const asset = await createAsset(app, adminToken, site.response.body.id);

    const { response: requesterResponse } = await registerUser(app, { role: "REQUESTER" });
    const requesterToken = requesterResponse.body.token;

    const createResponse = await request(app)
      .post("/api/inventory")
      .set(authHeader(requesterToken))
      .send({
        assetId: asset.response.body.id,
        partNumber: "PN-9999",
        location: "Shelf 1",
      });

    expect(createResponse.status).toBe(403);
  });
});
