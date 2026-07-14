const { DEFAULT_GREEN_TAG_CASES, applyStatusCompletedAt } = require("../src/services/greenTagDefaults");

describe("greenTagDefaults", () => {
  it("provides the default process cases", () => {
    expect(DEFAULT_GREEN_TAG_CASES.length).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_GREEN_TAG_CASES[0].title).toBe("Preparation");
    expect(DEFAULT_GREEN_TAG_CASES.every((item) => item.directions)).toBe(true);
  });

  it("sets completedAt when moving to COMPLETED", () => {
    const stamp = applyStatusCompletedAt("OPEN", "COMPLETED");
    expect(stamp).toBeInstanceOf(Date);
  });

  it("clears completedAt when leaving COMPLETED", () => {
    expect(applyStatusCompletedAt("COMPLETED", "OPEN", new Date())).toBeNull();
  });
});
