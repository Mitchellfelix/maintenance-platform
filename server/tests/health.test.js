const request = require("supertest");
const { getApp, describeIfDb, setupDbHooks } = require("./helpers");

describe("health routes", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  it("returns ok for liveness check", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("maintenance-platform");
  });

  it("lists API endpoints", async () => {
    const response = await request(app).get("/api");

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Maintenance Platform API");
    expect(response.body.endpoints).toContain("/api/health");
    expect(response.body.endpoints).toContain("/api/workorders");
  });
});

describeIfDb("health routes with database", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("returns ok when database is reachable", async () => {
    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database).toBe("up");
  });
});
