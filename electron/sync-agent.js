/**
 * Bidirectional last-write-wins sync between a local EMAT API and a team (remote) API.
 */
async function login(baseUrl, email, password) {
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.message || `Login failed (${response.status}) at ${baseUrl}`);
  }
  if (!body.token) throw new Error(`No token returned from ${baseUrl}`);
  return body.token;
}

async function pull(baseUrl, token, since) {
  const url = new URL("/api/sync/pull", baseUrl);
  if (since) url.searchParams.set("since", since);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.message || `Pull failed (${response.status})`);
  }
  return body;
}

async function push(baseUrl, token, changes) {
  const response = await fetch(new URL("/api/sync/push", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ changes }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.message || `Push failed (${response.status})`);
  }
  return body;
}

function countRows(changes = {}) {
  return Object.values(changes).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
}

/**
 * @param {{ localBase: string, remoteBase: string, email: string, password: string, since?: string|null }} opts
 */
async function syncBothWays(opts) {
  const localBase = String(opts.localBase).replace(/\/+$/, "");
  const remoteBase = String(opts.remoteBase).replace(/\/+$/, "");
  const since = opts.since || null;

  const [localToken, remoteToken] = await Promise.all([
    login(localBase, opts.email, opts.password),
    login(remoteBase, opts.email, opts.password),
  ]);

  const remotePull = await pull(remoteBase, remoteToken, since);
  const applyRemoteLocally = await push(localBase, localToken, remotePull.changes || {});
  if (applyRemoteLocally.errors?.length) {
    throw new Error(
      `Local apply failed (${applyRemoteLocally.errors.length} error(s)); sync cursor not advanced`,
    );
  }

  const localPull = await pull(localBase, localToken, since);
  const applyLocalRemotely = await push(remoteBase, remoteToken, localPull.changes || {});
  if (applyLocalRemotely.errors?.length) {
    throw new Error(
      `Remote apply failed (${applyLocalRemotely.errors.length} error(s)); sync cursor not advanced`,
    );
  }

  const stamps = [remotePull.nextSince, localPull.nextSince, new Date().toISOString()].filter(Boolean);
  const nextSince = stamps.sort().at(-1);

  return {
    nextSince,
    pulledFromRemote: countRows(remotePull.changes),
    pushedToLocal: applyRemoteLocally.summary,
    pulledFromLocal: countRows(localPull.changes),
    pushedToRemote: applyLocalRemotely.summary,
  };
}

module.exports = { syncBothWays, login, pull, push };
