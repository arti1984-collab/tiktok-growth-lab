/**
 * Runs a screenshot command only after backing up the real data file and
 * pointing the command at a separate data folder.
 *
 * Usage:
 *   npm run screenshots -- "npx electron scripts/shoot-screenshots.mjs"
 *
 * The command gets APP_DATA_DIR=data/screenshot-demo, so a screenshot server
 * can never open or overwrite data/store.json. Port 8787 must be free before
 * the run, which catches servers left over from an earlier attempt.
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const STORE = path.join(DATA, "store.json");
const STORE_BACKUP = path.join(DATA, "store.json.bak");
const BACKUP_ROOT = path.join(DATA, "screenshot-backups");
const DEMO_DIR = path.resolve(process.env.SCREENSHOT_DEMO_DIR || path.join(DATA, "screenshot-demo"));
const PORT = Number(process.env.SCREENSHOT_PORT || 8787);
const KEEP_BACKUPS = 10;

const command = process.argv.slice(2).join(" ").trim();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function appAnswers(port) {
  return new Promise((resolve) => {
    const request = http.get(
      { host: "127.0.0.1", port, path: "/api/status", timeout: 800 },
      (response) => {
        response.resume();
        resolve(true);
      },
    );
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function backupStore() {
  if (!fs.existsSync(STORE)) fail(`Keine Datendatei unter ${STORE}, nichts zu sichern.`);
  try {
    JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch (error) {
    fail(`Die Datendatei ist nicht lesbar (${error.message}). Bitte zuerst reparieren.`);
  }

  const target = path.join(BACKUP_ROOT, stamp());
  fs.mkdirSync(target, { recursive: true });

  const files = [];
  for (const source of [STORE, STORE_BACKUP]) {
    if (!fs.existsSync(source)) continue;
    const copy = path.join(target, path.basename(source));
    fs.copyFileSync(source, copy);
    const expected = sha256(source);
    const actual = sha256(copy);
    if (expected !== actual) fail(`Sicherung von ${source} ist unvollstaendig.`);
    files.push({ name: path.basename(source), size: fs.statSync(copy).size, sha256: actual });
  }

  fs.writeFileSync(
    path.join(target, "manifest.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), source: STORE, files }, null, 2)}\n`,
    "utf8",
  );

  const runs = fs
    .readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const old of runs.slice(0, Math.max(0, runs.length - KEEP_BACKUPS))) {
    fs.rmSync(path.join(BACKUP_ROOT, old), { recursive: true, force: true });
  }

  return target;
}

if (!command) {
  fail('Aufruf: npm run screenshots -- "<Befehl>"');
}

const backupDir = backupStore();

if (await appAnswers(PORT)) {
  fail(
    `Auf Port ${PORT} antwortet noch ein Server. Bitte beenden, damit keine alten Daten in die Aufnahme geraten.`,
  );
}

fs.mkdirSync(DEMO_DIR, { recursive: true });

console.log(`Sicherung: ${path.relative(ROOT, backupDir)}`);
console.log(`Demo-Daten: ${path.relative(ROOT, DEMO_DIR)}`);
console.log(`Starte: ${command}`);

const child = spawn(command, {
  cwd: ROOT,
  env: {
    ...process.env,
    APP_DATA_DIR: DEMO_DIR,
    AI_API_KEY: "",
    GITHUB_TOKEN: "",
    UPDATE_TOKEN: "",
    TIKTOK_COOKIE: "",
  },
  stdio: "inherit",
  shell: true,
});

child.on("error", (error) => fail(`Screenshot-Befehl konnte nicht starten: ${error.message}`));
child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Screenshot-Befehl durch ${signal} beendet.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
