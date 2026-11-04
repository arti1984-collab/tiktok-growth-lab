import assert from "node:assert/strict";
import test from "node:test";
import { checkSchema } from "../server/lib/schema.ts";

test("vollstaendige Strategie passt", () => {
  const issues = checkSchema("strategy", {
    diagnose: "x",
    positionierung: {},
    contentSaeulen: [{ name: "a", warum: "b" }],
    hooks: ["h"],
    postingPlan: [{ tag: "Montag", uhrzeit: "18:30", thema: "t", hook: "h" }],
    hashtagStrategie: {},
    kpiZiele: {},
  });
  assert.deepEqual(issues, []);
});

test("fehlende und falsche Felder werden benannt", () => {
  const issues = checkSchema("audit", { score: "hoch", staerken: [] });
  assert.ok(issues.some((issue) => issue.startsWith("score ist string")));
  assert.ok(issues.some((issue) => issue === "zusammenfassung fehlt"));
  assert.ok(issues.some((issue) => issue === "schwaechen fehlt"));
});

test("erster Listeneintrag wird geprueft", () => {
  const issues = checkSchema("calendar", { tage: [{ tag: "Montag" }] });
  assert.ok(issues.includes("tage[0].uhrzeit fehlt"));
  assert.ok(issues.includes("tage[0].thema fehlt"));
});

test("kein Objekt und unbekannter Modus", () => {
  assert.deepEqual(checkSchema("calendar", "text"), ["Antwort ist kein Objekt"]);
  assert.deepEqual(checkSchema("unbekannt", { irgendwas: 1 }), []);
});
