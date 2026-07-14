/** Default process cases seeded when an assignment is created without explicit cases. */
const DEFAULT_GREEN_TAG_CASES = [
  {
    title: "Preparation",
    sortOrder: 0,
    directions:
      "Confirm asset identity and safe work conditions.\n\n1. Verify asset name / serial against the tag sheet.\n2. Isolate energy sources as required.\n3. Gather tags, markers, and PPE.\n4. Review any prior greentagging notes for this asset.",
  },
  {
    title: "Inspection",
    sortOrder: 1,
    directions:
      "Inspect the asset before applying tags.\n\n1. Walk the asset and note defects or missing labels.\n2. Check mounting points and surfaces for the tags.\n3. Record findings that affect tagging (damage, access limits).\n4. Mark this case complete only when inspection is signed off.",
  },
  {
    title: "Tag application",
    sortOrder: 2,
    directions:
      "Apply greentags according to the local standard.\n\n1. Affix tags at approved locations on the asset.\n2. Ensure codes / identifiers are legible.\n3. Photograph completion if required by procedure.\n4. Note any tags that could not be applied and why.",
  },
  {
    title: "Verification & closeout",
    sortOrder: 3,
    directions:
      "Verify and close the greentagging effort.\n\n1. Confirm every required tag is in place.\n2. Update assignment status to Completed.\n3. Capture remaining follow-up work (if any) as a work order.\n4. Release the asset back to operations.",
  },
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

module.exports = {
  DEFAULT_GREEN_TAG_CASES,
  applyStatusCompletedAt,
};
