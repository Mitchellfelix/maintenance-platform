const request = require("supertest");
const { describeIfDb, getApp, registerUser, setupDbHooks, authHeader } = require("./helpers");

describeIfDb("sops routes", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("creates and lists department SOPs", async () => {
    const { response } = await registerUser(app, { role: "OPS_LEAD" });
    const token = response.body.token;

    const createResponse = await request(app)
      .post("/api/sops")
      .set(authHeader(token))
      .send({
        title: "Daily startup checklist",
        department: "Operations",
        summary: "Steps before bringing units online",
        content: "1. Inspect seals\n2. Verify power",
        version: "1.0",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.title).toBe("Daily startup checklist");
    expect(createResponse.body.department).toBe("Operations");

    const listResponse = await request(app).get("/api/sops").set(authHeader(token));
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    const filterResponse = await request(app)
      .get("/api/sops?department=Operations")
      .set(authHeader(token));
    expect(filterResponse.status).toBe(200);
    expect(filterResponse.body).toHaveLength(1);
  });

  it("archives prior version when an SOP is updated", async () => {
    const { response } = await registerUser(app, { role: "OPS_LEAD" });
    const token = response.body.token;

    const createResponse = await request(app)
      .post("/api/sops")
      .set(authHeader(token))
      .send({
        title: "Lockout tagout",
        department: "Safety",
        content: "Step 1: isolate power",
        version: "1.0",
      });

    const sopId = createResponse.body.id;

    const updateResponse = await request(app)
      .patch(`/api/sops/${sopId}`)
      .set(authHeader(token))
      .send({
        content: "Step 1: isolate power\nStep 2: verify zero energy",
        version: "1.1",
        changeNote: "Added verification step",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.version).toBe("1.1");

    const versionsResponse = await request(app).get(`/api/sops/${sopId}/versions`).set(authHeader(token));
    expect(versionsResponse.status).toBe(200);
    expect(versionsResponse.body).toHaveLength(1);
    expect(versionsResponse.body[0].version).toBe("1.0");
    expect(versionsResponse.body[0].content).toBe("Step 1: isolate power");
    expect(versionsResponse.body[0].changeNote).toBe("Added verification step");
  });

  it("blocks operators from publishing SOPs", async () => {
    const { response } = await registerUser(app, { role: "OPERATOR" });
    const token = response.body.token;

    const createResponse = await request(app)
      .post("/api/sops")
      .set(authHeader(token))
      .send({
        title: "Unauthorized SOP",
        department: "Safety",
      });

    expect(createResponse.status).toBe(403);
  });
});
