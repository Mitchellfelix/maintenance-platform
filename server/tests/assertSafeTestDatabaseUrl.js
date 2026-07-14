/**
 * Prevents integration tests from wiping the live application database.
 * Test DATABASE_URL must point at a dedicated DB whose name contains `_test`.
 */
function assertSafeTestDatabaseUrl(databaseUrl, { source = "DATABASE_URL" } = {}) {
  if (!databaseUrl || !String(databaseUrl).trim()) {
    return { ok: false, reason: `${source} is not set` };
  }

  let pathname;
  try {
    pathname = new URL(databaseUrl).pathname || "";
  } catch {
    return { ok: false, reason: `${source} is not a valid URL` };
  }

  const dbName = pathname.replace(/^\//, "").split("/")[0] || "";
  if (!dbName) {
    return { ok: false, reason: `${source} has no database name` };
  }

  // Block common live DB names even if someone adds `_test` as a suffix typo on the wrong DB.
  const liveNames = new Set(["maintenance_platform", "postgres", "emat", "production"]);
  if (liveNames.has(dbName)) {
    return {
      ok: false,
      reason: `${source} points at live database "${dbName}" — use a dedicated *_test database`,
    };
  }

  if (!/_test$/i.test(dbName) && !/_test_/i.test(dbName)) {
    return {
      ok: false,
      reason: `${source} database name "${dbName}" must end with _test (e.g. maintenance_platform_test)`,
    };
  }

  return { ok: true, dbName };
}

module.exports = { assertSafeTestDatabaseUrl };
