import type { AiMode } from "./prompts.ts";

/**
 * Schema-Guard: prueft die KI-Antwort gegen das, was die Oberflaeche erwartet.
 * Bewusst tolerant, denn ein fehlendes Feld soll die Antwort nicht wegwerfen,
 * sondern sichtbar machen, was fehlt.
 */

type Kind = "string" | "number" | "array" | "object";

type ModeSchema = {
  required: Record<string, Kind>;
  itemFields?: Record<string, string[]>;
};

const SCHEMAS: Record<string, ModeSchema> = {
  strategy: {
    required: {
      diagnose: "string",
      positionierung: "object",
      contentSaeulen: "array",
      hooks: "array",
      postingPlan: "array",
      hashtagStrategie: "object",
      kpiZiele: "object",
    },
    itemFields: {
      contentSaeulen: ["name", "warum"],
      postingPlan: ["tag", "uhrzeit", "thema", "hook"],
      wachstumshebel: ["hebel"],
    },
  },
  audit: {
    required: {
      score: "number",
      zusammenfassung: "string",
      staerken: "array",
      schwaechen: "array",
      schnellsteWins: "array",
    },
    itemFields: { schnellsteWins: ["massnahme"] },
  },
  ideas: {
    required: { ideen: "array" },
    itemFields: { ideen: ["titel", "hook", "format", "drehbuch"] },
  },
  caption: {
    required: { captions: "array" },
    itemFields: { captions: ["caption", "hashtags"] },
  },
  hooks: {
    required: { hooks: "array" },
    itemFields: { hooks: ["text", "typ"] },
  },
  calendar: {
    required: { tage: "array" },
    itemFields: { tage: ["tag", "uhrzeit", "thema", "hook"] },
  },
  hashtags: {
    required: { hashtagStrategie: "object", begruendung: "string" },
  },
};

function kindOf(value: unknown): Kind | "none" {
  if (value === undefined || value === null) return "none";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "none";
}

/** Liste der Abweichungen, leer heisst: passt. */
export function checkSchema(mode: AiMode | string, value: unknown): string[] {
  const schema = SCHEMAS[mode];
  if (!schema) return [];
  const actual = kindOf(value);
  if (actual !== "object") return ["Antwort ist kein Objekt"];
  const record = value as Record<string, unknown>;
  const issues: string[] = [];

  for (const [key, expected] of Object.entries(schema.required)) {
    const found = kindOf(record[key]);
    if (found === "none") issues.push(`${key} fehlt`);
    else if (found !== expected) issues.push(`${key} ist ${found}, erwartet ${expected}`);
  }

  for (const [key, fields] of Object.entries(schema.itemFields ?? {})) {
    const list = record[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const first = list[0];
    if (kindOf(first) !== "object") {
      issues.push(`${key}[0] ist kein Objekt`);
      continue;
    }
    const item = first as Record<string, unknown>;
    for (const field of fields) {
      const found = kindOf(item[field]);
      if (found === "none" || item[field] === "") issues.push(`${key}[0].${field} fehlt`);
    }
  }

  return issues;
}
