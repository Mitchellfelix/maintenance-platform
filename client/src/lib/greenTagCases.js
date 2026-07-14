/** Standard greentagging process case letters. */
export const GREEN_TAG_CASE_LETTERS = ["A", "B", "C", "D", "W"];

export const GREEN_TAG_CASE_OPTIONS = GREEN_TAG_CASE_LETTERS.map((letter) => ({
  value: `Case ${letter}`,
  label: `Case ${letter}`,
}));

export function caseSelectOptions(cases = []) {
  return cases.map((item) => ({
    value: item.id,
    label: `${item.title}${item.status === "COMPLETED" ? " ✓" : ""}`,
  }));
}

/** True when Case A–W are all present (by title). */
export function hasAllStandardCases(cases = []) {
  const titles = new Set(cases.map((item) => String(item.title || "").trim().toUpperCase()));
  return GREEN_TAG_CASE_OPTIONS.every((option) => titles.has(option.value.toUpperCase()));
}

/** Guard against HTML / error payloads from a stale API process. */
export function isAssignmentPayload(value) {
  return Boolean(value && typeof value === "object" && Array.isArray(value.cases));
}
