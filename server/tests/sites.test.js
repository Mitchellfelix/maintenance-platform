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

describeIfDb("site routes", () => {
  let app;
  let token;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  beforeEach(async () => {
    const { response } = await registerUser(app);
    token = response.body.token;
  });

  it("creates and lists sites", async () => {
    const createResponse = await request(app)
      .post("/api/sites")
      .set(authHeader(token))
      .send({ name: "Plant A", address: "123 Main St" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe("Plant A");

    const unauth = await request(app).get("/api/sites");
    expect(unauth.status).toBe(401);

    const listResponse = await request(app).get("/api/sites").set(authHeader(token));
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
  });

  it("returns a site by id", async () => {
    const { response: createResponse } = await createSite(app, token);

    const response = await request(app)
      .get(`/api/sites/${createResponse.body.id}`)
      .set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Plant A");
  });

  it("returns 404 for a missing site", async () => {
    const response = await request(app)
      .get("/api/sites/nonexistent-id")
      .set(authHeader(token));
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Site not found");
  });

  it("updates a site", async () => {
    const { response: createResponse } = await createSite(app, token);

    const response = await request(app)
      .patch(`/api/sites/${createResponse.body.id}`)
      .set(authHeader(token))
      .send({ name: "Plant A Updated" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Plant A Updated");
  });

  it("deletes a site with no linked records", async () => {
    const { response: createResponse } = await createSite(app, token);

    const response = await request(app)
      .delete(`/api/sites/${createResponse.body.id}`)
      .set(authHeader(token));

    expect(response.status).toBe(204);

    const getResponse = await request(app)
      .get(`/api/sites/${createResponse.body.id}`)
      .set(authHeader(token));
    expect(getResponse.status).toBe(404);
  });

  it("returns 400 for invalid site payloads", async () => {
    const response = await request(app)
      .post("/api/sites")
      .set(authHeader(token))
      .send({ address: "Missing name" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("blocks deleting a site with linked assets", async () => {
    const { response: siteResponse } = await createSite(app, token);
    await createAsset(app, token, siteResponse.body.id);

    const deleteResponse = await request(app)
      .delete(`/api/sites/${siteResponse.body.id}`)
      .set(authHeader(token));

    expect(deleteResponse.status).toBe(409);
    expect(deleteResponse.body.error).toBe("Site has linked assets or work orders");
  });
});
