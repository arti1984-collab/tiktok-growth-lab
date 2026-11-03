import { app, BrowserWindow, Menu, dialog, shell } from "electron";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = app.getAppPath();
const SERVER_ENTRY = path.join(ROOT, "build", "server", "index.mjs");
/**
 * Fixed folder name: Electron would otherwise derive it from package.json ("tiktok-growth-lab")
 * while the window and the .exe are called "TikTok Growth Lab".
 */
const DATA_DIR = app.isPackaged
  ? path.join(app.getPath("appData"), "TikTok Growth Lab", "data")
  : path.join(ROOT, "data");
const ICON = path.join(ROOT, "build", "icon.ico");

let mainWindow = null;

/** Tiny log next to the data file – helps when the app window stays empty. */
function log(message) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(path.join(DATA_DIR, "app.log"), `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // logging must never break startup
  }
}

/** Ask the OS for a free port so the app never collides with a running `npm run dev`. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error("Kein freier Port gefunden."))));
    });
  });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/status`);
      if (response.ok) return true;
    } catch {
      // server is still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    show: false,
    backgroundColor: "#0b0f14",
    title: "TikTok Growth Lab",
    icon: fs.existsSync(ICON) ? ICON : undefined,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // TikTok links and other external pages open in the default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(url)) shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });

  mainWindow.loadURL(url);
  return mainWindow;
}

async function boot() {
  if (!fs.existsSync(SERVER_ENTRY)) {
    dialog.showErrorBox(
      "TikTok Growth Lab",
      "Der Server-Build fehlt (build/server/index.mjs).\n\nBitte `npm run build:app` ausführen.",
    );
    app.quit();
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const port = await findFreePort();
  const url = `http://127.0.0.1:${port}`;

  process.env.APP_ENV = "production";
  process.env.APP_ROOT = ROOT;
  process.env.APP_DATA_DIR = DATA_DIR;
  process.env.HOST = "127.0.0.1";
  process.env.PORT = String(port);
  log(`start port=${port} packaged=${app.isPackaged} root=${ROOT}`);

  try {
    await import(pathToFileURL(SERVER_ENTRY).href);
  } catch (error) {
    log(`server error: ${error?.stack || error}`);
    dialog.showErrorBox("Server konnte nicht starten", String(error?.stack || error));
    app.quit();
    return;
  }

  const ready = await waitForServer(url);
  if (!ready) {
    log(`server nicht erreichbar: ${url}`);
    dialog.showErrorBox("TikTok Growth Lab", "Der lokale Server antwortet nicht. Bitte die App neu starten.");
    app.quit();
    return;
  }

  log(`ready ${url}`);
  createWindow(url);
}

if (!app.requestSingleInstanceLock()) {
  // Second launch: focus the window that is already open.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    boot();
  });

  app.on("window-all-closed", () => app.quit());
}
