const request = require("supertest");
const prisma = require("../src/lib/prisma");
const {
  describeIfDb,
  getApp,
  registerUser,
  setupDbHooks,
} = require("./helpers");
const { GENERIC_MESSAGE } = require("../src/services/passwordResetService");

describeIfDb("password reset", () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  setupDbHooks();

  it("always returns a generic message and resets for active users", async () => {
    const { response, payload } = await registerUser(app, { role: "ADMIN" });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();

    const missing = await request(app)
      .post("/api/auth/password-reset")
      .send({ email: "nobody@example.com" });
    expect(missing.status).toBe(200);
    expect(missing.body.message).toBe(GENERIC_MESSAGE);

    const resetRequest = await request(app)
      .post("/api/auth/password-reset")
      .send({ email: payload.email });
    expect(resetRequest.status).toBe(200);
    expect(resetRequest.body.message).toBe(GENERIC_MESSAGE);

    const reset = await prisma.passwordReset.findFirst({
      where: { userId: response.body.user.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(reset).toBeTruthy();

    const preview = await request(app).get(`/api/auth/password-reset/${reset.token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.email).toBe(payload.email);

    const complete = await request(app)
      .post(`/api/auth/password-reset/${reset.token}`)
      .send({ password: "newpassword99" });
    expect(complete.status).toBe(200);
    expect(complete.body.token).toBeTruthy();
    expect(complete.body.user.email).toBe(payload.email);

    const oldLogin = await request(app).post("/api/auth/login").send({
      email: payload.email,
      password: payload.password,
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({
      email: payload.email,
      password: "newpassword99",
    });
    expect(newLogin.status).toBe(200);

    const reused = await request(app)
      .post(`/api/auth/password-reset/${reset.token}`)
      .send({ password: "anotherpassword" });
    expect(reused.status).toBe(404);
  });

  it("rejects expired and invalid tokens", async () => {
    const { response } = await registerUser(app, { role: "ADMIN" });
    const userId = response.body.user.id;

    const expired = await prisma.passwordReset.create({
      data: {
        userId,
        token: "expired-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const expiredPreview = await request(app).get(`/api/auth/password-reset/${expired.token}`);
    expect(expiredPreview.status).toBe(410);

    const bad = await request(app).get("/api/auth/password-reset/not-a-real-token");
    expect(bad.status).toBe(404);
  });
});
