import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadJsonStore, writeJsonStore } from "../server/lib/storeFile.ts";

function dir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tgl-file-"));
}

type Shape = { value: number };

const normalize = (raw: unknown): { data: Shape; migrated: boolean } => {
  const parsed = raw as Partial<Shape>;
  if (typeof parsed?.value !== "number") throw new Error("kein Wert");
  return { data: { value: parsed.value }, migrated: false };
};

test("ein fehlendes store.json startet leer ohne Fehler", () => {
  const base = dir();
  const result = loadJsonStore<Shape>({
    file: path.join(base, "store.json"),
    backup: path.join(base, "store.json.bak"),
    empty: () => ({ value: 0 }),
    normalize,
  });
  assert.equal(result.data.value, 0);
  assert.equal(result.brokenFile, null);
  assert.equal(result.usedBackup, false);
  assert.equal(result.error, "");
});

test("jedes Schreiben legt den alten Stand als Sicherung ab", () => {
  const base = dir();
  const file = path.join(base, "store.json");
  const backup = `${file}.bak`;
  writeJsonStore(file, backup, { value: 1 });
  writeJsonStore(file, backup, { value: 2 });
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).value, 2);
  assert.equal(JSON.parse(fs.readFileSync(backup, "utf8")).value, 1);
});

test("eine kaputte Datei wird wegglegt und aus der Sicherung geladen", () => {
  const base = dir();
  const file = path.join(base, "store.json");
  const backup = `${file}.bak`;
  writeJsonStore(file, backup, { value: 7 });
  writeJsonStore(file, backup, { value: 8 });
  fs.writeFileSync(file, "{ kaputt", "utf8");

  const result = loadJsonStore<Shape>({ file, backup, empty: () => ({ value: 0 }), normalize });
  assert.equal(result.data.value, 7);
  assert.equal(result.usedBackup, true);
  assert.ok(result.brokenFile && fs.existsSync(result.brokenFile));
  assert.equal(fs.existsSync(file), false);
});

test("ist auch die Sicherung unlesbar, bleibt die kaputte Datei erhalten", () => {
  const base = dir();
  const file = path.join(base, "store.json");
  const backup = `${file}.bak`;
  fs.writeFileSync(file, "kein json", "utf8");
  fs.writeFileSync(backup, "auch kein json", "utf8");

  const result = loadJsonStore<Shape>({ file, backup, empty: () => ({ value: 3 }), normalize });
  assert.equal(result.data.value, 3);
  assert.equal(result.usedBackup, false);
  assert.ok(result.brokenFile && fs.existsSync(result.brokenFile));
});
