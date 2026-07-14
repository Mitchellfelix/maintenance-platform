const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const DOWNLOADS_DIR = path.join(__dirname, "..", "..", "public", "downloads");
const MAC_ZIP = "EMAT-mac.zip";
const READY_NAME = "EMAT-Tracking-Database.zip";
const APP_NAME = "EMAT Tracking Database.app";
const DEFAULTS_REL = path.join(APP_NAME, "Contents", "Resources", "team-defaults.json");

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

function baseZipPath() {
  return path.join(DOWNLOADS_DIR, MAC_ZIP);
}

function hasMacDownload() {
  return fs.existsSync(baseZipPath());
}

/**
 * Inject this host’s Team URL without corrupting the .app (macOS apps need
 * Frameworks symlinks — never rewrite the zip with adm-zip).
 */
function buildReadyZipFile(teamUrl) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "emat-ready-"));
  const outZip = path.join(stage, READY_NAME);
  try {
    execFileSync("ditto", ["-x", "-k", baseZipPath(), stage], { stdio: "pipe" });
    const defaultsPath = path.join(stage, DEFAULTS_REL);
    fs.mkdirSync(path.dirname(defaultsPath), { recursive: true });
    fs.writeFileSync(
      defaultsPath,
      `${JSON.stringify(
        {
          mode: "online",
          teamUrl: String(teamUrl || "").replace(/\/+$/, ""),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const appPath = path.join(stage, APP_NAME);
    if (fs.existsSync(appPath)) {
      try {
        execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "pipe" });
      } catch {
        // Ad-hoc sign is best-effort on non-mac hosts.
      }
    }

    const fixSrc = path.join(stage, "Fix & Open.command");
    if (!fs.existsSync(fixSrc)) {
      const fixFallback = path.join(__dirname, "..", "..", "..", "electron", "Fix & Open.command");
      if (fs.existsSync(fixFallback)) {
        fs.copyFileSync(fixFallback, fixSrc);
      }
    }
    if (fs.existsSync(fixSrc)) {
      fs.chmodSync(fixSrc, 0o755);
    }

    const entries = [APP_NAME];
    if (fs.existsSync(fixSrc)) entries.push("Fix & Open.command");
    execFileSync("zip", ["-ry", outZip, ...entries], { cwd: stage, stdio: "pipe" });
    return fs.readFileSync(outZip);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function renderJoinPage({ teamUrl, macReady }) {
  const safeUrl = escapeHtml(teamUrl);
  const downloadBlock = macReady
    ? `<a class="btn primary" href="/downloads/EMAT-ready.zip">Download Mac app</a>
       <p class="hint">Unzip, then open the app. If macOS says <strong>damaged</strong>, double-click <strong>Fix &amp; Open</strong> in the same folder (clears Gatekeeper).</p>
       <p class="hint">Prefer no Gatekeeper warning? Paste this in Terminal:</p>
       <pre class="term">curl -fsSL "${safeUrl}/downloads/EMAT-ready.zip" -o ~/Downloads/EMAT.zip &amp;&amp; \\
unzip -o ~/Downloads/EMAT.zip -d ~/Downloads/EMAT &amp;&amp; \\
xattr -cr ~/Downloads/EMAT/*.app &amp;&amp; \\
open ~/Downloads/EMAT/*.app</pre>`
    : `<p class="warn">Mac download is not packaged yet. Ask your host to run <code>npm run package:team-client</code>, or use the browser below.</p>`;

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
    pre.term {
      margin: 8px 0 0; padding: 12px 14px; border-radius: 12px; overflow-x: auto;
      background: #020617; border: 1px solid #334155; color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.45;
      white-space: pre-wrap; word-break: break-all;
    }
    .note { margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; font-size: 13px; color: #94a3b8; }
    .steps { margin: 0 0 18px; padding-left: 18px; color: #cbd5e1; }
    .steps li { margin: 6px 0; }
  </style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">EMAT Tracking Database</p>
    <h1>Download &amp; play</h1>
    <p>Same server, same data. Fastest paths:</p>
    <ol class="steps">
      <li><strong>Browser:</strong> play instantly below.</li>
      <li><strong>Mac app:</strong> download → unzip → open (or Fix &amp; Open) → sign in.</li>
    </ol>
    <span class="url">${safeUrl}</span>
    <div class="actions">
      <a class="btn primary" href="/">Play in this browser</a>
      ${downloadBlock}
    </div>
    <p class="note">First time? Use <strong>Request access</strong> on login, then wait for admin approval.</p>
  </main>
</body>
</html>`;
}

function createJoinHandler() {
  return (req, res) => {
    const teamUrl = detectPublicOrigin(req);
    res.type("html").send(renderJoinPage({ teamUrl, macReady: hasMacDownload() }));
  };
}

function createReadyZipHandler() {
  return (req, res) => {
    if (!hasMacDownload()) {
      return res.status(404).json({
        error: "Mac app not packaged yet. Host should run: npm run package:team-client",
      });
    }
    try {
      const teamUrl = detectPublicOrigin(req);
      const buffer = buildReadyZipFile(teamUrl);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${READY_NAME}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("EMAT ready zip failed:", error);
      res.status(500).json({ error: "Unable to build download" });
    }
  };
}

module.exports = {
  createJoinHandler,
  createReadyZipHandler,
  DOWNLOADS_DIR,
  MAC_ZIP,
  READY_NAME,
  hasMacDownload,
  buildReadyZipFile,
  detectPublicOrigin,
};
