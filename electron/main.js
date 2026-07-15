const { app, BrowserWindow, dialog, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const APP_NAME = "EMAT Tracking Database";
const DEFAULT_PORT = process.env.EMAT_PORT || "3000";
const HEALTH_PATH = "/api/health/db";
const WATCH_INTERVAL_MS = 8000;

let mainWindow = null;
let stackStarted = false;
let loadUrl = `http://localhost:${DEFAULT_PORT}`;
let isLocalMode = true;
let healthTimer = null;
let recovering = false;

function readAppUrl() {
  let url = `http://localhost:${DEFAULT_PORT}`;
  const envPath = path.join(ROOT, "server", ".env");

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^EMAT_APP_URL=(.+)$/m);
    if (match) {
      url = match[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  return url;
}

function isLocalAppUrl(url) {
  return /^https?:\/\/localhost(?::|\/|$)/.test(url) || /^https?:\/\/127\.0\.0\.1(?::|\/|$)/.test(url);
}

function pingHealth(baseUrl, timeoutMs = 2500) {
  let healthUrl;
  try {
    healthUrl = new URL(HEALTH_PATH, baseUrl);
  } catch {
    return Promise.resolve(false);
  }

  // Railway / team hosts are HTTPS — http.get alone cannot reach them.
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
      const ok = await pingHealth(baseUrl);
      if (ok) {
        resolve();
        return;
      }
      tries += 1;
      if (tries >= attempts) {
        reject(new Error(`Cannot reach ${new URL(HEALTH_PATH, baseUrl)}`));
        return;
      }
      setTimeout(attempt, 500);
    }

    attempt();
  });
}

function startStack() {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [path.join(ROOT, "scripts/start-stack.sh")], {
      cwd: ROOT,
      env: { ...process.env, EMAT_PORT: DEFAULT_PORT },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        stackStarted = true;
        resolve();
      } else {
        reject(new Error(`start-stack.sh exited with code ${code}`));
      }
    });
  });
}

async function recoverStack() {
  if (!isLocalMode || recovering) {
    return;
  }
  recovering = true;
  try {
    await startStack();
    await waitForHealth(loadUrl, 40);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  } catch (error) {
    console.error("EMAT recovery failed:", error.message);
  } finally {
    recovering = false;
  }
}

function startHealthWatch() {
  stopHealthWatch();
  healthTimer = setInterval(async () => {
    const ok = await pingHealth(loadUrl);
    if (ok) {
      return;
    }
    if (isLocalMode) {
      void recoverStack();
    }
  }, WATCH_INTERVAL_MS);
}

function stopHealthWatch() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

function resolveDockIcon() {
  const candidates = [
    path.join(ROOT, "apps", `${APP_NAME}.app`, "Contents", "Resources", "AppIcon.icns"),
    path.join(ROOT, "client", "public", "icons", "icon.svg"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate);
      if (!image.isEmpty()) {
        return image;
      }
    }
  }

  return null;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#020617",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  let loadRetries = 0;
  mainWindow.loadURL(url);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) {
      return; // aborted
    }
    console.error("Window failed to load:", errorCode, errorDescription);
    if (loadRetries < 5) {
      loadRetries += 1;
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 1000 * loadRetries);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function focusWindow() {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

async function boot() {
  const appUrl = readAppUrl();
  isLocalMode = isLocalAppUrl(appUrl);
  loadUrl = isLocalMode ? `http://localhost:${DEFAULT_PORT}` : appUrl;

  try {
    if (isLocalMode) {
      await startStack();
      await waitForHealth(loadUrl);
    } else {
      await waitForHealth(loadUrl);
    }
  } catch (error) {
    dialog.showErrorBox(
      APP_NAME,
      error.message || "EMAT could not start. Check Docker, server/.env, and .emat-app.log.",
    );
    app.quit();
    return;
  }

  if (!mainWindow) {
    createWindow(loadUrl);
  } else if (!mainWindow.isDestroyed()) {
    mainWindow.loadURL(loadUrl);
  }

  startHealthWatch();
}

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

  app.on("child-process-gone", (_event, details) => {
    console.error("Child process gone:", details);
  });

  app.whenReady().then(() => {
    app.setName(APP_NAME);

    if (process.platform === "darwin") {
      const icon = resolveDockIcon();
      if (icon) {
        app.dock.setIcon(icon);
      }
    }

    return boot();
  });

  app.on("activate", () => {
    if (mainWindow) {
      focusWindow();
    } else {
      boot();
    }
  });

  app.on("window-all-closed", () => {
    stopHealthWatch();
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    stopHealthWatch();
  });
}
