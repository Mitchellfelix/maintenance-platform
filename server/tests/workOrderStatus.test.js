const { applyStatusTimestamps } = require("../src/services/workOrderStatus");

describe("applyStatusTimestamps", () => {
  const existing = {
    status: "OPEN",
    startedAt: null,
    completedAt: null,
  };

  it("sets startedAt when moving to IN_PROGRESS", () => {
    const result = applyStatusTimestamps(existing, { status: "IN_PROGRESS" });
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeUndefined();
  });

  it("does not overwrite an existing startedAt", () => {
    const startedAt = new Date("2026-01-01T00:00:00Z");
    const result = applyStatusTimestamps(
      { ...existing, startedAt },
      { status: "IN_PROGRESS" },
    );
    expect(result.startedAt).toBeUndefined();
  });

  it("sets completedAt when moving to COMPLETED", () => {
    const result = applyStatusTimestamps(existing, { status: "COMPLETED" });
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it("passes through unrelated updates", () => {
    const result = applyStatusTimestamps(existing, { title: "Updated title" });
    expect(result.title).toBe("Updated title");
    expect(result.startedAt).toBeUndefined();
    expect(result.completedAt).toBeUndefined();
  });
});
