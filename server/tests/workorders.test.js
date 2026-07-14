const request = require("supertest");
const {
  describeIfDb,
  getApp,
  registerUser,
  createSite,
  setupDbHooks,
  authHeader,
} = require("./helpers");

describeIfDb("work order routes", () => {
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

  it("creates a work order with an auto-generated code", async () => {
    const response = await request(app)
      .post("/api/workorders")
      .set(authHeader(token))
      .send({ title: "Fix pump", siteId });

    expect(response.status).toBe(201);
    expect(response.body.code).toMatch(/^WO-\d{4}-\d{5}$/);
    expect(response.body.title).toBe("Fix pump");
  });

  it("lists and fetches work orders", async () => {
    const createResponse = await request(app)
      .post("/api/workorders")
      .set(authHeader(token))
      .send({ title: "Fix pump", siteId });

    const listResponse = await request(app).get("/api/workorders").set(authHeader(token));
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    const detailResponse = await request(app)
      .get(`/api/workorders/${createResponse.body.id}`)
      .set(authHeader(token));
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.title).toBe("Fix pump");
  });

  it("returns 404 for a missing work order", async () => {
    const response = await request(app)
      .get("/api/workorders/nonexistent-id")
      .set(authHeader(token));
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Work order not found");
  });

  it("sets startedAt when status moves to IN_PROGRESS", async () => {
    const createResponse = await request(app)
      .post("/api/workorders")
      .set(authHeader(token))
      .send({ title: "Fix pump", siteId });

    const response = await request(app)
      .patch(`/api/workorders/${createResponse.body.id}`)
      .set(authHeader(token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("IN_PROGRESS");
    expect(response.body.startedAt).toBeTruthy();
  });

  it("sets completedAt when status moves to COMPLETED", async () => {
    const createResponse = await request(app)
      .post("/api/workorders")
      .set(authHeader(token))
      .send({ title: "Fix pump", siteId });

    const response = await request(app)
      .patch(`/api/workorders/${createResponse.body.id}`)
      .set(authHeader(token))
      .send({ status: "COMPLETED" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("COMPLETED");
    expect(response.body.completedAt).toBeTruthy();
  });

  it("deletes a work order", async () => {
    const createResponse = await request(app)
      .post("/api/workorders")
      .set(authHeader(token))
      .send({ title: "Fix pump", siteId });

    const deleteResponse = await request(app)
      .delete(`/api/workorders/${createResponse.body.id}`)
      .set(authHeader(token));

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/api/workorders/${createResponse.body.id}`)
      .set(authHeader(token));
    expect(getResponse.status).toBe(404);
  });

  it("returns 400 for invalid work order payloads", async () => {
    const response = await request(app)
      .post("/api/workorders")
      .set(authHeader(token))
      .send({ description: "Missing title and siteId" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("generates unique codes under concurrent creation", async () => {
    const payload = { title: "Concurrent job", siteId };
    const requests = Array.from({ length: 5 }, () =>
      request(app)
        .post("/api/workorders")
        .set(authHeader(token))
        .send(payload),
    );

    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(201);
      expect(response.body.code).toMatch(/^WO-\d{4}-\d{5}$/);
    }

    const codes = responses.map((response) => response.body.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
