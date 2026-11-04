import { labelFor } from "./components/JsonView";
import { activeLanguage } from "./lang";

const locale = () => (activeLanguage() === "en" ? "en-US" : "de-DE");
const english = () => activeLanguage() === "en";

/**
 * Textdatei statt JSON: Überschriften je Block, zwei Leerzeichen Einzug,
 * Zeilen auf 88 Zeichen umbrochen, damit die Datei im Editor, auf Papier und
 * auf dem Handy ohne waagerechtes Scrollen lesbar bleibt.
 */

const WIDTH = 88;
const HEAD_KEYS = ["titel", "name", "hebel", "massnahme", "text", "caption", "tag", "typ"];

const isPrimitive = (value: unknown) => value === null || ["string", "number", "boolean"].includes(typeof value);

const label = (key: string) => labelFor(key);

function primitive(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? (english() ? "yes" : "ja") : english() ? "no" : "nein";
  if (typeof value === "number") return value.toLocaleString(locale());
  return String(value);
}

function wrap(text: string, indent = 0): string[] {
  const pad = " ".repeat(indent);
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [`${pad}-`];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && pad.length + current.length + 1 + word.length > WIDTH) {
      lines.push(pad + current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(pad + current);
  return lines;
}

function wrapItem(text: string, indent: number, bullet: string): string[] {
  const lines = wrap(text, indent + bullet.length);
  lines[0] = `${" ".repeat(indent)}${bullet}${lines[0].trimStart()}`;
  return lines;
}

function renderArray(items: unknown[], depth: number): string[] {
  const pad = "  ".repeat(depth);
  const out: string[] = [];
  items.forEach((item, index) => {
    if (isPrimitive(item)) {
      out.push(...wrapItem(primitive(item), pad.length, "- "));
      return;
    }
    if (Array.isArray(item)) {
      out.push(...renderArray(item, depth + 1));
      return;
    }
    if (item && typeof item === "object") {
      const fields = Object.entries(item as Record<string, unknown>);
      const headKey = fields.find(([key]) => HEAD_KEYS.includes(key))?.[0];
      const head = headKey ? primitive((item as Record<string, unknown>)[headKey]) : `${english() ? "Entry" : "Eintrag"} ${index + 1}`;
      out.push(...wrapItem(head, pad.length, `${index + 1}. `));
      for (const [key, value] of fields) {
        if (key === headKey) continue;
        out.push(...renderEntry(key, value, depth + 1));
      }
      out.push("");
    }
  });
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

function renderEntry(key: string, value: unknown, depth: number): string[] {
  const pad = "  ".repeat(depth);
  const name = label(key);
  if (isPrimitive(value)) {
    const text = primitive(value);
    if (typeof value === "string" && pad.length + name.length + text.length > WIDTH - 8) {
      return [`${pad}${name}:`, ...wrap(text, pad.length + 2)];
    }
    return [`${pad}${name}: ${text}`];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${name}: -`];
    return [`${pad}${name}:`, ...renderArray(value, depth + 1)];
  }
  if (value && typeof value === "object") {
    const out = [`${pad}${name}:`];
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out.push(...renderEntry(childKey, childValue, depth + 1));
    }
    return out;
  }
  return [`${pad}${name}: -`];
}

export function buildTextExport(input: {
  title: string;
  model: string;
  handle?: string | null;
  result: unknown;
  date?: Date;
}): string {
  const date = input.date ?? new Date();
  const lines: string[] = [
    "TikTok Growth Lab",
    input.title,
    `${english() ? "Date" : "Datum"}: ${date.toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })}`,
  ];
  if (input.handle) lines.push(`Account: @${input.handle}`);
  lines.push(`${english() ? "Model" : "Modell"}: ${input.model || (english() ? "unknown" : "unbekannt")}`, "", "=".repeat(64), "");

  const result = input.result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
      lines.push(label(key).toUpperCase(), "");
      if (isPrimitive(value)) {
        lines.push(...wrap(primitive(value), 2));
      } else if (Array.isArray(value)) {
        lines.push(...renderArray(value, 0));
      } else {
        lines.push(...renderEntry(key, value, 0).slice(1));
      }
      lines.push("");
    }
  } else {
    lines.push(...wrap(String(result ?? (english() ? "No answer received." : "Keine Antwort erhalten.")), 0), "");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function textFilename(title: string, date = new Date()): string {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `tiktok-growth-lab-${slug || (english() ? "ai-answer" : "ki-antwort")}-${day}.txt`;
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
