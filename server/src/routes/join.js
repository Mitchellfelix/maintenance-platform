const fs = require("fs");
const path = require("path");

const DOWNLOADS_DIR = path.join(__dirname, "..", "..", "public", "downloads");
const MAC_ZIP = "EMAT-mac.zip";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detectPublicOrigin(req) {
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:3000";
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function renderJoinPage({ teamUrl, hasMacDownload }) {
  const safeUrl = escapeHtml(teamUrl);
  const downloadBlock = hasMacDownload
    ? `<a class="btn primary" href="/downloads/${MAC_ZIP}">Download for Mac</a>
       <p class="hint">Unzip, open <strong>EMAT Tracking Database</strong>, paste the Team URL once, then sign in.</p>`
    : `<p class="warn">Mac download is not packaged yet on this host. Ask your admin to run <code>npm run package:team-client</code>, or use the browser button below.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Join EMAT</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at top left, rgba(249,115,22,.2), transparent 42%),
                  linear-gradient(165deg, #020617 0%, #0f172a 50%, #111827 100%);
      color: #f8fafc; display: grid; place-items: center; padding: 24px;
    }
    .card {
      width: min(560px, 100%); background: rgba(15,23,42,.92); border: 1px solid #334155;
      border-radius: 24px; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,.35);
    }
    .eyebrow { margin: 0 0 8px; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: #fdba74; font-weight: 700; }
    h1 { margin: 0 0 12px; font-size: 30px; }
    p { margin: 0 0 16px; color: #94a3b8; line-height: 1.5; }
    .url {
      display: block; margin: 0 0 20px; padding: 12px 14px; border-radius: 12px;
      background: #020617; border: 1px solid #334155; color: #fdba74; word-break: break-all; font-family: ui-monospace, monospace; font-size: 14px;
    }
    .actions { display: grid; gap: 12px; }
    .btn {
      display: inline-flex; justify-content: center; align-items: center; text-decoration: none;
      border-radius: 12px; padding: 12px 16px; font-weight: 700; font-size: 15px;
    }
    .btn.primary { background: linear-gradient(90deg, #f97316, #f59e0b); color: white; }
    .btn.secondary { border: 1px solid #475569; color: #e2e8f0; background: transparent; }
    .hint, .warn { margin: 8px 0 0; font-size: 13px; }
    .warn { color: #fdba74; }
    code { color: #fdba74; }
    .note { margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; font-size: 13px; color: #94a3b8; }
  </style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">EMAT Tracking Database</p>
    <h1>Join your team</h1>
    <p>Same server, same data. Pick the fastest option for you.</p>
    <span class="url">${safeUrl}</span>
    <div class="actions">
      ${downloadBlock}
      <a class="btn secondary" href="/">Open in this browser</a>
    </div>
    <p class="note">First time here? Use <strong>Request access</strong> on the login page, then wait for an admin to approve you.</p>
  </main>
</body>
</html>`;
}

function createJoinHandler() {
  return (req, res) => {
    const teamUrl = detectPublicOrigin(req);
    const zipPath = path.join(DOWNLOADS_DIR, MAC_ZIP);
    const hasMacDownload = fs.existsSync(zipPath);
    res.type("html").send(renderJoinPage({ teamUrl, hasMacDownload }));
  };
}

module.exports = {
  createJoinHandler,
  DOWNLOADS_DIR,
  MAC_ZIP,
};
