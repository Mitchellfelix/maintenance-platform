const { assertSafeTestDatabaseUrl } = require("./assertSafeTestDatabaseUrl");

describe("assertSafeTestDatabaseUrl", () => {
  it("allows dedicated test database names", () => {
    expect(
      assertSafeTestDatabaseUrl(
        "postgresql://maintenance:maintenance@localhost:5432/maintenance_platform_test",
      ).ok,
    ).toBe(true);
  });

  it("rejects the live maintenance_platform database", () => {
    const result = assertSafeTestDatabaseUrl(
      "postgresql://maintenance:maintenance@localhost:5432/maintenance_platform",
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/live database/i);
  });

  it("rejects missing or unsuffixed database names", () => {
    expect(assertSafeTestDatabaseUrl("").ok).toBe(false);
    expect(
      assertSafeTestDatabaseUrl("postgresql://u:p@localhost:5432/emat_prod").ok,
    ).toBe(false);
  });
});
