import assert from "node:assert/strict";
import test from "node:test";
import { checkSchema } from "../server/lib/schema.ts";

const plan = Array.from({ length: 28 }, (_, index) => ({
  woche: Math.floor(index / 7) + 1,
  tag: "Montag",
  uhrzeit: "18:30",
  thema: "t",
  hook: "h",
}));

const strategy = (postingPlan: unknown[]) => ({
  diagnose: "x",
  positionierung: {},
  contentSaeulen: [{ name: "a", warum: "b" }],
  hooks: ["h"],
  postingPlan,
  hashtagStrategie: {},
  kpiZiele: {},
});

test("vollstaendige Strategie mit 28 Tagen passt", () => {
  assert.deepEqual(checkSchema("strategy", strategy(plan)), []);
});

test("kurzer Plan wird als Hinweis gemeldet", () => {
  const issues = checkSchema("strategy", strategy(plan.slice(0, 7)));
  assert.ok(issues.some((issue) => issue.includes("28 Eintraegen")), issues.join(", "));
});

test("Plan-Eintrag ohne Woche wird benannt", () => {
  const withoutWeek = plan.map((entry) => ({ ...entry, woche: undefined }));
  const issues = checkSchema("strategy", strategy(withoutWeek));
  assert.ok(issues.includes("postingPlan[0].woche fehlt"));
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
