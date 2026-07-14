/** Standard greentagging process cases (Case A–W). */
const GREEN_TAG_CASE_LETTERS = ["A", "B", "C", "D", "W"];

/** Default process cases seeded when an assignment is created without explicit cases. */
const DEFAULT_GREEN_TAG_CASES = GREEN_TAG_CASE_LETTERS.map((letter, index) => ({
  title: `Case ${letter}`,
  sortOrder: index,
  directions: `Directions for greentagging Case ${letter}.\n\n1. Confirm this is the correct case type for the work.\n2. Follow local Case ${letter} procedure.\n3. Capture photos / evidence as required.\n4. Mark this case complete when finished.`,
}));

/** Default overall checklist items seeded with new assignments. */
const DEFAULT_GREEN_TAG_CHECKLIST = [
  { label: "Confirm asset identity (name / serial)", sortOrder: 0 },
  { label: "Gather greentags, markers, and required PPE", sortOrder: 1 },
  { label: "Complete required cases (A, B, C, D, and/or W)", sortOrder: 2 },
  { label: "Photograph or document completed tags", sortOrder: 3 },
  { label: "Notify ops lead / release asset to operations", sortOrder: 4 },
];

function applyStatusCompletedAt(existingStatus, nextStatus, existingCompletedAt) {
  if (nextStatus === "COMPLETED" && existingStatus !== "COMPLETED") {
    return new Date();
  }
  if (nextStatus && nextStatus !== "COMPLETED") {
    return null;
  }
  return existingCompletedAt === undefined ? undefined : existingCompletedAt;
}

function missingStandardCases(existingCases = []) {
  const titles = new Set(existingCases.map((item) => String(item.title || "").trim().toUpperCase()));
  return DEFAULT_GREEN_TAG_CASES.filter((item) => !titles.has(item.title.toUpperCase()));
}

module.exports = {
  GREEN_TAG_CASE_LETTERS,
  DEFAULT_GREEN_TAG_CASES,
  DEFAULT_GREEN_TAG_CHECKLIST,
  applyStatusCompletedAt,
  missingStandardCases,
};
