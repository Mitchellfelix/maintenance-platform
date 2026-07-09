const { app, BrowserWindow, dialog, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const APP_NAME = "EMAT Tracking Database";
const DEFAULT_PORT = process.env.EMAT_PORT || "3000";

let mainWindow = null;
let stackStarted = false;

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

function waitForHealth(baseUrl, attempts = 60) {
  const healthUrl = new URL("/api/health", baseUrl);

  return new Promise((resolve, reject) => {
    let tries = 0;

    function ping() {
      const request = http.get(healthUrl, (response) => {
        response.resume();
        if (response.statusCode === 200) {
          resolve();
        } else if (tries >= attempts) {
          reject(new Error(`Health check failed with status ${response.statusCode}`));
        } else {
          tries += 1;
          setTimeout(ping, 500);
        }
      });

      request.on("error", () => {
        if (tries >= attempts) {
          reject(new Error(`Cannot reach ${healthUrl}`));
          return;
        }
        tries += 1;
        setTimeout(ping, 500);
      });
    }

    ping();
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
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(url);

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
  const localMode = isLocalAppUrl(appUrl);
  const loadUrl = localMode ? `http://localhost:${DEFAULT_PORT}` : appUrl;

  try {
    if (localMode) {
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

  createWindow(loadUrl);
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusWindow();
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
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
