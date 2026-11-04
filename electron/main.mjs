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
let fallbackWindow = null;

/**
 * The server falls back to this when TikTok answers with 403 or a captcha.
 * A real Chromium window loads the page like a visitor: hidden while it works,
 * shown when a captcha has to be solved by hand. Its cookies are handed back so
 * the normal requests work again afterwards.
 */
const BLOCK_PATTERN = /captcha|verify you are human|unusual traffic|access denied|ratelimit triggered/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getFallbackWindow() {
  if (fallbackWindow && !fallbackWindow.isDestroyed()) return fallbackWindow;
  fallbackWindow = new BrowserWindow({
    width: 1100,
    height: 860,
    show: false,
    title: "TikTok Growth Lab – TikTok öffnen",
    backgroundColor: "#141210",
    webPreferences: {
      partition: "persist:tiktok-fallback",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  fallbackWindow.setMenuBarVisibility(false);
  fallbackWindow.on("closed", () => {
    fallbackWindow = null;
  });
  return fallbackWindow;
}

async function collectCookie(win) {
  const cookies = await win.webContents.session.cookies.get({ domain: ".tiktok.com" });
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function browserFetchPage(url) {
  const win = getFallbackWindow();
  log(`browser fallback: ${url}`);
  try {
    await win.loadURL(url);
  } catch (error) {
    log(`browser fallback load error: ${error?.message || error}`);
  }

  let shown = false;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const html = await win.webContents.executeJavaScript(
      "document.documentElement ? document.documentElement.outerHTML : ''",
    );
    if (html && !BLOCK_PATTERN.test(html)) {
      if (shown) win.hide();
      return { html, cookie: await collectCookie(win) };
    }
    if (!shown) {
      // A captcha cannot be solved unseen, so the window comes to the front once.
      win.show();
      win.focus();
      shown = true;
      log("browser fallback: captcha window shown");
    }
    await sleep(2000);
  }
  const html = await win.webContents.executeJavaScript(
    "document.documentElement ? document.documentElement.outerHTML : ''",
  );
  return { html, cookie: await collectCookie(win) };
}

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

  // The bundled server checks for this bridge before its own requests give up.
  globalThis.__tiktokBrowser = { fetchPage: browserFetchPage };

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
  app.on("before-quit", () => {
    if (fallbackWindow && !fallbackWindow.isDestroyed()) fallbackWindow.destroy();
  });
}
