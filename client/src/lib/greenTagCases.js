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
