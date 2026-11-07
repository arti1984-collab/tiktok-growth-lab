import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Der Speicher liest seinen Ordner beim Import, deshalb muss er vorher stehen.
const base = fs.mkdtempSync(path.join(os.tmpdir(), "tgl-store-"));
process.env.APP_DATA_DIR = base;

const store = await import("../server/lib/store.ts");
import type { StoredScan } from "../server/lib/store.ts";

const snapshot = (followers: number) => ({
  at: Date.now(),
  followers,
  following: 10,
  hearts: 100,
  videos: 5,
  engagementRate: 4.2,
  score: 61,
});

test("ein Konto behaelt hoechstens 200 Messpunkte", () => {
  store.trackAccount("capcheck", "Cap", "");
  for (let index = 0; index < 205; index += 1) {
    store.addSnapshot("capcheck", snapshot(1000 + index));
  }
  const account = store.listAccounts().find((entry) => entry.handle === "capcheck");
  assert.ok(account);
  assert.equal(account.snapshots.length, 200);
  assert.equal(account.snapshots[account.snapshots.length - 1].followers, 1204);
});

test("ein entferntes Konto ist weg, die Messreihe bleibt in der Datei nicht haengen", () => {
  store.trackAccount("wegdamit", "Weg", "");
  assert.equal(store.untrackAccount("@WEGDAMIT"), true);
  assert.equal(store.listAccounts().some((entry) => entry.handle === "wegdamit"), false);
});

test("Termine mit kaputtem Datum fallen raus, alte Termine werden gekuerzt", () => {
  const old = new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10);
  store.addPlan([
    { date: "31.12.2026", time: "18:00" },
    { date: old, time: "18:00" },
    { date: "2099-01-01", time: "25:00" },
    { date: "2099-01-01", time: "18:00", note: "bleibt" },
  ]);
  const plan = store.listPlan();
  assert.equal(plan.length, 1);
  assert.equal(plan[0].note, "bleibt");
});

test("Einstellungen halten Grenzen ein und Ziele haengen am Profil", () => {
  store.updateSettings({ language: "en", minDelayMs: 50 });
  assert.equal(store.publicSettings().language, "en");
  assert.equal(store.publicSettings().minDelayMs, 400);

  store.updateSettings({ minDelayMs: 99_999 });
  assert.equal(store.publicSettings().minDelayMs, 10_000);

  store.updateSettings({ goal: { handle: "@ziel", followers: 5000, date: "2027-05-01", startFollowers: 900 } });
  assert.equal(store.publicSettings().goals.length, 1);
  assert.equal(store.publicSettings().goals[0].handle, "ziel");

  store.updateSettings({ removeGoal: "ZIEL" });
  assert.equal(store.publicSettings().goals.length, 0);
});

test("mehr als fuenf Scans werden nicht aufgehoben, der neueste gewinnt", () => {
  for (let index = 0; index < 7; index += 1) {
    store.saveStoredScan({
      profile: { handle: `scan${index}` } as unknown as StoredScan["profile"],
      videos: [],
      metrics: {} as unknown as StoredScan["metrics"],
      warnings: [],
      durationMs: 10,
      scannedAt: Date.now() + index,
      timezone: "Europe/Berlin",
    });
  }
  const scans = store.listStoredScans();
  assert.equal(scans.length, 5);
  assert.equal(scans[0].profile.handle, "scan6");
});

test("Export und Import bringen Messreihen zurueck", () => {
  store.trackAccount("sicherung", "Sicherung", "");
  store.addSnapshot("sicherung", snapshot(4321));
  const dump = store.exportData();
  assert.equal(dump.app, "tiktok-growth-lab");
  assert.ok(dump.accounts.some((entry) => entry.handle === "sicherung"));

  store.untrackAccount("sicherung");
  assert.equal(store.listAccounts().some((entry) => entry.handle === "sicherung"), false);

  const counts = store.importData(JSON.parse(JSON.stringify(dump)));
  assert.ok(counts.accounts >= 1);
  const restored = store.listAccounts().find((entry) => entry.handle === "sicherung");
  assert.ok(restored);
  assert.equal(restored.snapshots[0].followers, 4321);
});

test("eine fremde Datei wird abgelehnt", () => {
  assert.throws(() => store.importData({ app: "etwas-anderes" }), store.ImportError);
  assert.throws(() => store.importData(null), store.ImportError);
});

test("die Datendatei und ihre Sicherung liegen im Datenordner", () => {
  // Zweimal schreiben, damit die Sicherung des ersten Standes entsteht.
  store.flushPersist();
  store.updateSettings({ timezone: "Europe/Berlin" });
  store.flushPersist();
  const info = store.storeInfo();
  assert.equal(info.file, path.join(base, "store.json"));
  assert.equal(info.backup, path.join(base, "store.json.bak"));
  assert.ok(fs.existsSync(info.file));
  assert.ok(fs.existsSync(info.backup));
});
