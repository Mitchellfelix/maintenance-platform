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

describeIfDb("asset routes", () => {
  let app;
  let token;
  let siteId;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  beforeEach(async () => {
    const { response } = await registerUser(app);
    token = response.body.token;

    const { response: siteResponse } = await createSite(app, token);
    siteId = siteResponse.body.id;
  });

  it("creates and lists assets", async () => {
    const createResponse = await request(app)
      .post("/api/assets")
      .set(authHeader(token))
      .send({ siteId, name: "Pump 1", serialNumber: "SN-001" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe("Pump 1");

    const listResponse = await request(app).get("/api/assets");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
  });

  it("returns an asset by id", async () => {
    const { response: createResponse } = await createAsset(app, token, siteId, {
      serialNumber: "SN-002",
    });

    const response = await request(app).get(`/api/assets/${createResponse.body.id}`);
    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Pump 1");
  });

  it("returns 404 for a missing asset", async () => {
    const response = await request(app).get("/api/assets/nonexistent-id");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Asset not found");
  });

  it("updates an asset", async () => {
    const { response: createResponse } = await createAsset(app, token, siteId);

    const response = await request(app)
      .patch(`/api/assets/${createResponse.body.id}`)
      .set(authHeader(token))
      .send({ name: "Pump 1 Updated" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Pump 1 Updated");
  });

  it("deletes an asset with no linked work orders", async () => {
    const { response: createResponse } = await createAsset(app, token, siteId);

    const response = await request(app)
      .delete(`/api/assets/${createResponse.body.id}`)
      .set(authHeader(token));

    expect(response.status).toBe(204);
  });

  it("returns 400 for invalid asset payloads", async () => {
    const response = await request(app)
      .post("/api/assets")
      .set(authHeader(token))
      .send({ name: "Missing siteId" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("returns 409 for duplicate serial numbers", async () => {
    await createAsset(app, token, siteId, { serialNumber: "SN-DUP" });

    const response = await request(app)
      .post("/api/assets")
      .set(authHeader(token))
      .send({ siteId, name: "Pump 2", serialNumber: "SN-DUP" });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Duplicate value");
  });

  it("returns 400 for an invalid siteId", async () => {
    const response = await request(app)
      .post("/api/assets")
      .set(authHeader(token))
      .send({ siteId: "nonexistent-site", name: "Pump X" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Related record not found");
  });

  it("blocks deleting an asset with linked work orders", async () => {
    const { response: assetResponse } = await createAsset(app, token, siteId);

    await request(app)
      .post("/api/workorders")
      .set(authHeader(token))
      .send({ title: "Inspect pump", siteId, assetId: assetResponse.body.id });

    const deleteResponse = await request(app)
      .delete(`/api/assets/${assetResponse.body.id}`)
      .set(authHeader(token));

    expect(deleteResponse.status).toBe(409);
    expect(deleteResponse.body.error).toBe("Asset has linked work orders");
  });
});
