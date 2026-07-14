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

const APP_NAME = "EMAT Tracking Database";
const HEALTH_PATH = "/api/health/db";

let mainWindow = null;
let teamUrl = "";

function configPath() {
  return path.join(app.getPath("userData"), "team-url.json");
}

function readSavedUrl() {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const data = JSON.parse(raw);
    const url = typeof data?.url === "string" ? data.url.trim() : "";
    return url || "";
  } catch {
    return "";
  }
}

function saveTeamUrl(url) {
  const cleaned = String(url || "")
    .trim()
    .replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(cleaned)) {
    throw new Error("Team URL must start with http:// or https://");
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ url: cleaned }, null, 2));
  teamUrl = cleaned;
  return cleaned;
}

function clearTeamUrl() {
  try {
    fs.unlinkSync(configPath());
  } catch {
    // ignore
  }
  teamUrl = "";
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

function setupHtmlPath() {
  return path.join(__dirname, "team-setup.html");
}

function preloadPath() {
  return path.join(__dirname, "team-preload.js");
}

function resolveDockIcon() {
  const candidates = [
    path.join(__dirname, "build", "icon.png"),
    path.join(__dirname, "..", "client", "public", "icons", "icon.png"),
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#020617",
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath(),
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

function showSetup() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  mainWindow.loadFile(setupHtmlPath());
}

async function openTeamUrl(url) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }

  const ok = await pingHealth(url);
  if (!ok) {
    const result = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      buttons: ["Try anyway", "Change URL", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: APP_NAME,
      message: "Cannot reach the team server",
      detail: `Tried ${url}${HEALTH_PATH}. Check that you are on the same network/VPN and the host is running.`,
    });
    if (result === 1) {
      clearTeamUrl();
      showSetup();
      return;
    }
    if (result === 2) {
      return;
    }
  }

  mainWindow.loadURL(url);
}

async function boot() {
  teamUrl = readSavedUrl();
  if (!teamUrl) {
    showSetup();
    return;
  }
  await openTeamUrl(teamUrl);
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

function buildMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [process.platform === "darwin" ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Change Team URL…",
          click: () => {
            clearTeamUrl();
            showSetup();
          },
        },
        {
          label: "Open Team URL in Browser",
          click: () => {
            const url = teamUrl || readSavedUrl();
            if (url) void shell.openExternal(url);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("team:get-url", () => teamUrl || readSavedUrl());

ipcMain.handle("team:save-url", async (_event, url) => {
  const saved = saveTeamUrl(url);
  await openTeamUrl(saved);
  return { ok: true, url: saved };
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  process.on("uncaughtException", (error) => {
    console.error("Electron uncaught exception:", error);
    dialog.showErrorBox(APP_NAME, error.message || "EMAT hit an unexpected error and needs to close.");
    app.quit();
  });

  app.on("second-instance", () => {
    focusWindow();
  });

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
