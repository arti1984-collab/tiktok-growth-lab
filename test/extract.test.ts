import assert from "node:assert/strict";
import test from "node:test";
import { extractJson } from "../server/lib/ai.ts";

test("Komma vor der schliessenden Klammer wird repariert", () => {
  const parsed = extractJson('{"tage":[{"tag":"Montag","uhrzeit":"18:30",},],}') as { tage?: unknown[] };
  assert.equal(parsed.tage?.length, 1);
});

test("echter Zeilenumbruch im String wird gerettet", () => {
  const parsed = extractJson('{"ideen":[{"titel":"Zeile eins\nZeile zwei"}]}') as { ideen?: { titel: string }[] };
  assert.match(parsed.ideen?.[0]?.titel ?? "", /Zeile eins/);
});

test("JSON in Prosa und Code-Fence", () => {
  const prose = extractJson('Hier ist das JSON:\n```json\n{"hooks":[{"text":"a","typ":"Frage"}]}\n```\nViel Erfolg.');
  assert.ok(prose);
  const fenced = extractJson("```json\n{\"score\": 70}\n```") as { score?: number };
  assert.equal(fenced.score, 70);
});

test("ein kaputter Eintrag versteckt die anderen nicht", () => {
  const parsed = extractJson('{"tage":[{"tag":"Montag","uhrzeit":"18:30"},{"tag":"Dienstag",}]}') as {
    tage?: { tag: string }[];
  };
  assert.ok((parsed.tage?.length ?? 0) >= 1);
});

test("reiner Text liefert null", () => {
  assert.equal(extractJson("Das Modell hat nur Prosa geschrieben."), null);
});
