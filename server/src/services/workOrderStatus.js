function applyStatusTimestamps(existing, updates) {
  const data = { ...updates };

  if (updates.status === "IN_PROGRESS" && !existing.startedAt && data.startedAt === undefined) {
    data.startedAt = new Date();
  }

  if (updates.status === "COMPLETED" && data.completedAt === undefined) {
    data.completedAt = new Date();
  }

  return data;
}

module.exports = { applyStatusTimestamps };
