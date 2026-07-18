const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  ipcMain,
  shell,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const { syncBothWays } = require("./sync-agent");

const APP_NAME = "EMAT Tracking Database";
const HEALTH_PATH = "/api/health/db";
const LOCAL_URL = "http://127.0.0.1:3000";

let mainWindow = null;
let config = { mode: "", teamUrl: "", lastSyncAt: null };
let stackStarted = false;

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTeamUrl(value) {
  const trimmed = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  if (!trimmed || !isSafeHttpUrl(trimmed)) {
    throw new Error("Team URL must be a valid http:// or https:// address");
  }
  return trimmed;
}

function openExternalSafe(url) {
  if (!isSafeHttpUrl(url)) return false;
  void shell.openExternal(url);
  return true;
}

function configPath() {
  return path.join(app.getPath("userData"), "emat-config.json");
}

function readPackagedDefaults() {
  const candidates = [
    typeof process.resourcesPath === "string" ? path.join(process.resourcesPath, "team-defaults.json") : null,
    path.join(__dirname, "team-defaults.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const data = JSON.parse(fs.readFileSync(candidate, "utf8"));
      const teamUrl = typeof data?.teamUrl === "string" ? data.teamUrl.trim().replace(/\/+$/, "") : "";
      if (teamUrl && /^https?:\/\//i.test(teamUrl)) {
        return {
          mode: data.mode === "offline" ? "offline" : "online",
          teamUrl,
        };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const data = JSON.parse(raw);
    return {
      mode: data.mode === "online" || data.mode === "offline" ? data.mode : "",
      teamUrl: typeof data.teamUrl === "string" ? data.teamUrl.trim().replace(/\/+$/, "") : "",
      lastSyncAt: typeof data.lastSyncAt === "string" ? data.lastSyncAt : null,
    };
  } catch {
    // migrate old team-url.json
    try {
      const legacy = path.join(app.getPath("userData"), "team-url.json");
      const raw = fs.readFileSync(legacy, "utf8");
      const data = JSON.parse(raw);
      if (data?.url) {
        return { mode: "online", teamUrl: String(data.url).replace(/\/+$/, ""), lastSyncAt: null };
      }
    } catch {
      // ignore
    }
    return { mode: "", teamUrl: "", lastSyncAt: null };
  }
}

function writeConfig(next) {
  config = { ...config, ...next };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(
    configPath(),
    JSON.stringify(
      {
        mode: config.mode,
        teamUrl: config.teamUrl || "",
        lastSyncAt: config.lastSyncAt || null,
      },
      null,
      2,
    ),
  );
  return config;
}

function isLanOrLocalHost(url) {
  try {
    const host = new URL(String(url || "").trim()).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function healStaleTeamConfig() {
  const defaults = readPackagedDefaults();
  if (!defaults?.teamUrl || !/^https:\/\//i.test(defaults.teamUrl)) {
    return false;
  }

  // Common after LAN→Railway: packaged app still stuck in offline / old LAN Team URL.
  const staleOffline = config.mode === "offline";
  const staleLanUrl = Boolean(config.teamUrl) && isLanOrLocalHost(config.teamUrl);
  if (!staleOffline && !staleLanUrl) {
    return false;
  }

  writeConfig({
    mode: "online",
    teamUrl: defaults.teamUrl,
  });
  return true;
}

function resolveProjectRoot() {
  const marker = path.join(app.getPath("home"), ".emat", "home");
  if (fs.existsSync(marker)) {
    const root = fs.readFileSync(marker, "utf8").trim();
    if (root && fs.existsSync(path.join(root, "scripts", "start-stack.sh"))) {
      return root;
    }
  }
  const candidate = path.join(__dirname, "..");
  if (fs.existsSync(path.join(candidate, "scripts", "start-stack.sh"))) {
    return candidate;
  }
  return null;
}

function pingHealth(baseUrl, timeoutMs = 4000) {
  let healthUrl;
  try {
    healthUrl = new URL(HEALTH_PATH, baseUrl);
  } catch {
    return Promise.resolve(false);
  }
  const transport = healthUrl.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const request = transport.get(healthUrl, { timeout: timeoutMs }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function waitForHealth(baseUrl, attempts = 60) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    async function attempt() {
      if (await pingHealth(baseUrl)) {
        resolve();
        return;
      }
      tries += 1;
      if (tries >= attempts) {
        reject(new Error(`Cannot reach ${baseUrl}${HEALTH_PATH}`));
        return;
      }
      setTimeout(attempt, 500);
    }
    attempt();
  });
}

function startLocalStack(projectRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [path.join(projectRoot, "scripts", "start-stack.sh")], {
      cwd: projectRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        stackStarted = true;
        resolve();
      } else {
        reject(new Error(`Local stack failed to start (exit ${code}). Is Docker Desktop running?`));
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "team-preload.js"),
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: "deny" };
  });
}

function showSetup() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.loadFile(path.join(__dirname, "team-setup.html"));
}

async function openUrl(url) {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.loadURL(url);
}

async function bootOffline() {
  const projectRoot = resolveProjectRoot();
  if (!projectRoot) {
    dialog.showMessageBoxSync({
      type: "warning",
      title: APP_NAME,
      message: "Offline mode needs a local project install",
      detail:
        "On this Mac run once from the repo:\n  npm run app:install\n\nOffline uses Docker Desktop + a local database. Online team mode does not need that.",
    });
    showSetup();
    return;
  }

  try {
    if (!(await pingHealth(LOCAL_URL))) {
      await startLocalStack(projectRoot);
      await waitForHealth(LOCAL_URL);
    }
    await openUrl(LOCAL_URL);
  } catch (error) {
    dialog.showErrorBox(APP_NAME, error.message || "Unable to start offline mode");
    showSetup();
  }
}

async function bootOnline() {
  const url = config.teamUrl;
  if (!url) {
    showSetup();
    return;
  }

  const ok = await pingHealth(url);
  if (!ok) {
    const result = dialog.showMessageBoxSync(mainWindow || undefined, {
      type: "warning",
      buttons: ["Try anyway", "Change settings", "Switch to offline"],
      defaultId: 0,
      cancelId: 1,
      title: APP_NAME,
      message: "Team server not reachable",
      detail: `${url} looks offline. You can keep trying, change the URL, or work offline (local DB) until sync.`,
    });
    if (result === 1) {
      showSetup();
      return;
    }
    if (result === 2) {
      writeConfig({ mode: "offline" });
      await bootOffline();
      return;
    }
  }

  await openUrl(url);
}

async function boot() {
  config = readConfig();

  // First launch from a Join-page download: Team URL is already baked into the app.
  if (!config.mode) {
    const defaults = readPackagedDefaults();
    if (defaults?.teamUrl) {
      writeConfig({ mode: defaults.mode || "online", teamUrl: defaults.teamUrl });
      config = readConfig();
    }
  }

  // Repair stuck offline/LAN configs left over from before Railway go-live.
  if (healStaleTeamConfig()) {
    config = readConfig();
  }

  if (!config.mode) {
    showSetup();
    return;
  }
  if (config.mode === "online") {
    await bootOnline();
    return;
  }
  await bootOffline();
}

function focusWindow() {
  if (!mainWindow) {
    void boot();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function runSyncDialog() {
  config = readConfig();
  if (!config.teamUrl) {
    dialog.showMessageBoxSync({
      type: "info",
      title: APP_NAME,
      message: "Set a Team URL first",
      detail: "Choose Online mode once (or Help → Change mode) and save your Team URL, then sync.",
    });
    showSetup();
    return;
  }

  const creds = await promptCredentials();
  if (!creds) return;

  const localBase = LOCAL_URL;
  const remoteBase = config.teamUrl;

  if (!(await pingHealth(localBase))) {
    dialog.showErrorBox(
      APP_NAME,
      "Local database is not running. Start offline mode once (or open the Dock app) so sync can read/write local data.",
    );
    return;
  }
  if (!(await pingHealth(remoteBase))) {
    dialog.showErrorBox(APP_NAME, `Team server is not reachable at ${remoteBase}`);
    return;
  }

  try {
    const result = await syncBothWays({
      localBase,
      remoteBase,
      email: creds.email,
      password: creds.password,
      since: config.lastSyncAt,
    });
    writeConfig({ lastSyncAt: result.nextSince });
    dialog.showMessageBox({
      type: "info",
      title: APP_NAME,
      message: "Sync complete",
      detail: [
        `Pulled from team: ${result.pulledFromRemote} row(s)`,
        `Pulled from local: ${result.pulledFromLocal} row(s)`,
        `Cursor: ${result.nextSince}`,
        "",
        "Newest change wins when both sides edited the same record. Photos are not synced yet.",
      ].join("\n"),
    });
  } catch (error) {
    dialog.showErrorBox(APP_NAME, error.message || "Sync failed");
  }
}

function promptCredentials() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler("team:sync-credentials");
      if (!win.isDestroyed()) win.close();
      resolve(value);
    };

    const win = new BrowserWindow({
      width: 420,
      height: 360,
      title: "Sync credentials",
      parent: mainWindow || undefined,
      modal: Boolean(mainWindow),
      resizable: false,
      backgroundColor: "#020617",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, "team-preload.js"),
      },
    });

    ipcMain.handle("team:sync-credentials", async (_event, payload) => {
      finish(payload?.email && payload?.password ? payload : null);
      return { ok: true };
    });

    const html = `<!doctype html><html><head><meta charset="UTF-8" /><style>
      body{font-family:system-ui;background:#020617;color:#f8fafc;padding:24px}
      label{display:block;margin:12px 0 6px;font-size:13px}
      input{width:100%;padding:10px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff}
      button{margin-top:18px;width:100%;padding:10px;border:0;border-radius:10px;background:#f97316;color:#fff;font-weight:700}
      p{color:#94a3b8;font-size:13px;line-height:1.4}
    </style></head><body>
      <p>Sign in with the <strong>same email/password</strong> on local and team.</p>
      <label>Email</label><input id="email" type="email" />
      <label>Password</label><input id="password" type="password" />
      <button id="go">Sync now</button>
      <script>
        document.getElementById('go').onclick = async () => {
          const email = document.getElementById('email').value.trim();
          const password = document.getElementById('password').value;
          await window.ematTeam.submitSyncCredentials({ email, password });
        };
      </script>
    </body></html>`;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.on("closed", () => finish(null));
  });
}

function buildMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{ label: APP_NAME, submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] }]
      : []),
    { label: "File", submenu: [process.platform === "darwin" ? { role: "close" } : { role: "quit" }] },
    {
      label: "Edit",
      submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "togglefullscreen" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Change mode / Team URL…",
          click: () => showSetup(),
        },
        {
          label: "Sync now…",
          click: () => {
            void runSyncDialog();
          },
        },
        {
          label: "Open Team URL in Browser",
          click: () => {
            const url = readConfig().teamUrl;
            if (url) openExternalSafe(url);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("team:get-config", () => readConfig());
ipcMain.handle("team:get-url", () => readConfig().teamUrl || "");

ipcMain.handle("team:save-config", async (_event, payload) => {
  const mode = payload?.mode === "online" ? "online" : "offline";
  let teamUrl = typeof payload?.teamUrl === "string" ? payload.teamUrl.trim().replace(/\/+$/, "") : "";
  if (mode === "online") {
    teamUrl = normalizeTeamUrl(teamUrl);
  } else if (teamUrl && !isSafeHttpUrl(teamUrl)) {
    throw new Error("Team URL must be a valid http:// or https:// address");
  }
  writeConfig({ mode, teamUrl: teamUrl || config.teamUrl || "" });
  if (mode === "online") await bootOnline();
  else await bootOffline();
  return config;
});

// Back-compat for older setup form
ipcMain.handle("team:save-url", async (_event, url) => {
  writeConfig({ mode: "online", teamUrl: normalizeTeamUrl(url) });
  await bootOnline();
  return { ok: true, url: config.teamUrl };
});

function resolveDockIcon() {
  const candidates = [
    path.join(__dirname, "build", "icon.png"),
    path.join(__dirname, "..", "client", "public", "icons", "icon.svg"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate);
      if (!image.isEmpty()) return image;
    }
  }
  return null;
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  process.on("uncaughtException", (error) => {
    console.error(error);
    dialog.showErrorBox(APP_NAME, error.message || "Unexpected error");
    app.quit();
  });

  app.on("second-instance", () => focusWindow());

  app.whenReady().then(() => {
    app.setName(APP_NAME);
    buildMenu();
    if (process.platform === "darwin") {
      const icon = resolveDockIcon();
      if (icon) app.dock.setIcon(icon);
    }
    return boot();
  });

  app.on("activate", () => {
    if (mainWindow) focusWindow();
    else void boot();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
