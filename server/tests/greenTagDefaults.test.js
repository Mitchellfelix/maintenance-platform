const {
  DEFAULT_GREEN_TAG_CASES,
  DEFAULT_GREEN_TAG_CHECKLIST,
  GREEN_TAG_CASE_LETTERS,
  applyStatusCompletedAt,
  missingStandardCases,
} = require("../src/services/greenTagDefaults");

describe("greenTagDefaults", () => {
  it("provides Case A–W as the default process cases", () => {
    expect(DEFAULT_GREEN_TAG_CASES).toHaveLength(5);
    expect(DEFAULT_GREEN_TAG_CASES.map((item) => item.title)).toEqual([
      "Case A",
      "Case B",
      "Case C",
      "Case D",
      "Case W",
    ]);
    expect(GREEN_TAG_CASE_LETTERS).toEqual(["A", "B", "C", "D", "W"]);
    expect(DEFAULT_GREEN_TAG_CASES.every((item) => item.directions)).toBe(true);
  });

  it("detects missing standard cases", () => {
    expect(missingStandardCases([{ title: "Case A" }, { title: "Case C" }]).map((item) => item.title)).toEqual([
      "Case B",
      "Case D",
      "Case W",
    ]);
    expect(missingStandardCases(DEFAULT_GREEN_TAG_CASES)).toEqual([]);
  });

  it("provides a default overall checklist", () => {
    expect(DEFAULT_GREEN_TAG_CHECKLIST.length).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_GREEN_TAG_CHECKLIST.every((item) => item.label)).toBe(true);
  });

  it("sets completedAt when moving to COMPLETED", () => {
    const stamp = applyStatusCompletedAt("OPEN", "COMPLETED");
    expect(stamp).toBeInstanceOf(Date);
  });

  it("clears completedAt when leaving COMPLETED", () => {
    expect(applyStatusCompletedAt("COMPLETED", "OPEN", new Date())).toBeNull();
  });
});
