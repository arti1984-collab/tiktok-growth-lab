import { chat, extractJson } from "./ai.ts";
import { checkSchema } from "./schema.ts";
import { recordAiCall } from "./stats.ts";
import { WEEKDAYS, type Metrics } from "./metrics.ts";
import { getLang, tr } from "./lang.ts";
import { gateInstruction, type QualityGate } from "./quality.ts";

const WEEKDAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const weekdayLabel = (weekday: number): string =>
  (getLang() === "en" ? WEEKDAYS_EN : WEEKDAYS)[weekday - 1] ?? String(weekday);
import type { Profile, Video } from "./tiktok.ts";

export const AI_MODES = ["strategy", "audit", "ideas", "caption", "hooks", "calendar", "hashtags"] as const;
export type AiMode = (typeof AI_MODES)[number];

export type AiPayload = {
  niche?: string;
  topic?: string;
  tone?: string;
  count?: number;
  goal?: string;
  extra?: string;
};

export type ScanContext = { profile: Profile; videos: Video[]; metrics: Metrics };

/**
 * Der Systemprompt richtet sich nach der eingestellten Sprache. Die Feldnamen
 * im JSON bleiben gleich, damit die Oberfläche und der Export sie weiter
 * zuordnen können; nur die Inhalte wechseln die Sprache.
 */
function systemPrompt(): string {
  return tr(
    `Du bist ein TikTok-Growth-Stratege für den DACH-Markt (Deutschland, Österreich, Schweiz).
Du kennst den TikTok-Algorithmus 2026: Watchtime und Retention in den ersten 3 Sekunden zählen am meisten, danach Shares, Saves,
Kommentare und Completion-Rate; Follower-Conversion entsteht über Wiedererkennung, Serienformate und klare Profil-Versprechen.
Regeln:
- Antworte ausschließlich auf Deutsch.
- Antworte ausschließlich mit gültigem JSON, exakt nach dem vorgegebenen Schema. Kein Markdown, keine Erklärungen außerhalb des JSON.
- Arbeite mit den gelieferten, gescrapten Daten. Erfinde keine Zahlen. Wenn Daten fehlen, sag es im dafür vorgesehenen Feld.
- Sei radikal konkret: echte Hooks in natürlicher Sprache, echte Uhrzeiten, echte Captions. Keine Floskeln wie "sei authentisch".
- Jeder Tipp muss in einem TikTok-Video umsetzbar sein, ohne Equipment-Käufe.
- Zahlen in JSON-Feldern als echte Zahlen, keine Strings mit Einheiten.`,
    `You are a TikTok growth strategist for the German-speaking market (Germany, Austria, Switzerland).
You know the 2026 TikTok algorithm: watch time and retention in the first 3 seconds matter most, then shares, saves, comments and
completion rate; follower conversion comes from recognition, recurring formats and a clear profile promise.
Rules:
- Answer exclusively in English.
- Answer with valid JSON only, exactly in the given schema. No markdown, no explanations outside the JSON.
- Work with the scraped data you receive. Never invent numbers. If data is missing, say so in the field meant for it.
- Be radically concrete: real hooks in natural language, real times of day, real captions. No filler like "be authentic".
- Every tip must be doable in a TikTok video without buying equipment.
- The JSON keys stay as given; every text value inside them is in English, including weekdays.
- Numbers in JSON fields are real numbers, not strings with units.`,
  );
}

function contextBlock(context: ScanContext | undefined): string {
  if (!context) {
    return "KEIN GESCRAPTER KONTEXT: Der Nutzer hat noch keinen Scan durchgeführt. Arbeite nur mit den Angaben aus der Anfrage und markiere Annahmen klar.";
  }
  const { profile, metrics, videos } = context;
  const lines: string[] = [];
  lines.push(
    `PROFIL: @${profile.handle} (${profile.nickname}) · ${profile.followers} Follower · ${profile.videos} Videos · ${profile.hearts} Likes gesamt · verifiziert: ${
      profile.verified ? "ja" : "nein"
    } · Region: ${profile.region || "unbekannt"}`,
  );
  if (profile.bio) lines.push(`BIO: ${profile.bio.slice(0, 200)}`);

  if (metrics.hasData) {
    lines.push(`METRIKEN aus ${metrics.sampleSize} gescrapten Videos:`);
    lines.push(`- Growth-Score: ${metrics.score}/100`);
    lines.push(
      `- Ø Views ${metrics.avgViews} · Median ${metrics.medianViews} · Views pro Follower ${(metrics.viewsPerFollower ?? 0).toFixed(2)}`,
    );
    lines.push(
      `- Engagement-Rate ${(metrics.engagementRate ?? 0).toFixed(2)} % (Likes ${(metrics.likeRate ?? 0).toFixed(2)} %, Kommentare ${(
        metrics.commentRate ?? 0
      ).toFixed(2)} %, Shares ${(metrics.shareRate ?? 0).toFixed(2)} %, Saves ${(metrics.saveRate ?? 0).toFixed(2)} %)`,
    );
    lines.push(
      `- Rhythmus ${metrics.postsPerWeek?.toFixed(1) ?? "?"} Posts/Woche · letzter Post vor ${Math.round(
        metrics.daysSinceLastPost ?? 0,
      )} Tagen · Ø Videolänge ${metrics.avgDuration}s`,
    );
    if (metrics.bestSlots.length > 0) {
      lines.push(
        `- Beste Zeitfenster: ${metrics.bestSlots
          .map((slot) => `${weekdayLabel(slot.weekday)} ${slot.hour}:00 (Ø ${slot.avgViews} Views, ${slot.posts} Posts)`)
          .join(" · ")}`,
      );
    }
    if (metrics.hashtags.length > 0) {
      lines.push(
        `- Hashtags: ${metrics.hashtags
          .slice(0, 6)
          .map((tag) => `#${tag.tag} (${tag.posts}×, Ø ${tag.avgViews})`)
          .join(", ")}`,
      );
    }
    if (metrics.durationBuckets.some((bucket) => bucket.posts > 0)) {
      lines.push(
        `- Längen-Performance: ${metrics.durationBuckets
          .filter((bucket) => bucket.posts > 0)
          .map((bucket) => `${bucket.label}: Ø ${bucket.avgViews} Views / ${bucket.posts} Videos`)
          .join(" · ")}`,
      );
    }
    lines.push(`- Hook-Signale: Ø ${metrics.hookSignals.avgDescLength} Zeichen Caption, ${metrics.hookSignals.avgHashtags.toFixed(1)} Hashtags/Video`);
  } else {
    lines.push("POST-DATEN: keine (noch keine Video-Links gescannt). Profil-Stats sind live, Post-Performance fehlt.");
  }

  if (videos.length > 0) {
    lines.push("GESCRAPTE VIDEOS (neueste zuerst):");
    videos.slice(0, 10).forEach((video, index) => {
      lines.push(
        `${index + 1}. "${(video.desc || "(ohne Caption)").slice(0, 90)}" · ${video.views} Views · ${video.likes} Likes · ${video.comments} Kommentare · ${
          video.durationSec
        }s · ${new Date(video.createdAt * 1000).toISOString().slice(0, 10)}`,
      );
    });
  }
  return lines.join("\n");
}

const SCHEMAS: Record<AiMode, string> = {
  strategy: `{
  "diagnose": "2-4 Sätze: was den Account aktuell ausbremst, mit Bezug auf die Zahlen",
  "positionierung": { "nische": "", "zielgruppe": "", "alleinstellung": "", "profilVersprechen": "", "bioVorschlag": "" },
  "contentSaeulen": [ { "name": "", "anteilProzent": 0, "warum": "", "beispielThemen": ["", ""] } ],
  "hooks": ["10 fertige Hook-Sätze, die in den ersten 2 Sekunden funktionieren"],
  "postingPlan": [ { "tag": "Montag", "uhrzeit": "18:30", "format": "", "thema": "", "hook": "" } ],
  "hashtagStrategie": { "nische": [""], "reichweite": [""], "marke": [""] },
  "soundStrategie": ["", ""],
  "seoKeywords": ["Begriffe, die in Caption und On-Screen-Text vorkommen sollten"],
  "wachstumshebel": [ { "hebel": "", "warum": "", "schritte": ["", ""] } ],
  "kpiZiele": { "followerIn30Tagen": 0, "viewsProVideo": 0, "engagementRateProzent": 0 },
  "warnung": "was der Account NICHT tun sollte"
}`,
  audit: `{
  "score": 0,
  "zusammenfassung": "3-5 Sätze",
  "staerken": [ "" ],
  "schwaechen": [ "" ],
  "schnellsteWins": [ { "massnahme": "", "erwarteteWirkung": "", "aufwand": "niedrig|mittel|hoch", "umsetzungInMinuten": 0 } ],
  "contentLuecken": [ "" ],
  "risiken": [ "" ],
  "fazit": ""
}`,
  ideas: `{
  "ideen": [ {
    "titel": "",
    "hook": "erster gesprochener Satz, max. 12 Wörter",
    "format": "z. B. Talking Head, POV, Tutorial, Duett, Storytime",
    "drehbuch": [ { "sekunde": "0-3", "bild": "", "text": "" } ],
    "cta": "",
    "warumEsFunktioniert": "",
    "hashtags": [ "" ],
    "sound": "",
    "schwierigkeit": "leicht|mittel|hoch",
    "ziel": "Reichweite|Follower|Interaktion|Saves"
  } ]
}`,
  caption: `{
  "captions": [ { "caption": "", "hashtags": [ "" ], "onScreenText": "", "cta": "", "begruendung": "" } ],
  "hinweis": ""
}`,
  hooks: `{
  "hooks": [ { "text": "", "typ": "Frage|Zahl|Provokation|Versprechen|Story|Fehler", "zielgruppe": "", "warum": "" } ],
  "hinweis": ""
}`,
  calendar: `{
  "tage": [ { "tag": "Montag", "uhrzeit": "18:30", "thema": "", "hook": "", "format": "", "sound": "", "hashtags": [ "" ], "cta": "", "aufwand": "niedrig|mittel|hoch" } ],
  "hinweis": ""
}`,
  hashtags: `{
  "hashtagStrategie": { "nische": [""], "reichweite": [""], "marke": [""] },
  "begruendung": "2-4 Sätze: warum diese Sets zur Nische passen",
  "suchbegriffe": [ "Begriffe, nach denen die Zielgruppe in TikTok sucht" ],
  "hinweis": "was beim Einsatz der Tags zu beachten ist"
}`,
};

function payloadBlock(payload: AiPayload): string {
  const entries: string[] = [];
  if (payload.niche) entries.push(`Nische/Thema: ${payload.niche}`);
  if (payload.topic) entries.push(`Konkretes Thema/Video: ${payload.topic}`);
  if (payload.tone) entries.push(`Tonalität: ${payload.tone}`);
  if (payload.goal) entries.push(`Ziel: ${payload.goal}`);
  if (payload.count) entries.push(`Anzahl der Ergebnisse: ${Math.max(1, Math.min(20, payload.count))}`);
  if (payload.extra) entries.push(`Zusatzinfos: ${payload.extra}`);
  return entries.length > 0 ? entries.join("\n") : "Keine weiteren Angaben – leite alles aus dem Kontext ab.";
}

function modeInstruction(mode: AiMode, payload: AiPayload): string {
  const count = Math.max(1, Math.min(20, payload.count ?? 5));
  switch (mode) {
    case "strategy":
      return `Erstelle eine vollständige 30-Tage-Wachstumsstrategie. Nutze die echten besten Zeitfenster aus den Metriken. Der Posting-Plan enthält 7 Einträge (eine Woche). Fülle hashtagStrategie vollständig: 5 bis 8 Nischen-Tags, 5 bis 8 Reichweiten-Tags und 2 bis 4 Marken-Tags, jeweils mit #, in Kleinbuchstaben, ohne Duplikate zwischen den Gruppen.`;
    case "audit":
      return `Mache ein schonungsloses Profil-Audit. Bewerte Score 0-100 auf Basis der gelieferten Daten. Nenne die 3 Maßnahmen mit dem besten Wirkung/Aufwand-Verhältnis zuerst.`;
    case "ideas":
      return `Entwickle ${count} Video-Ideen, die auf den Mustern der besten gescrapten Videos aufbauen. Jede Idee braucht ein Drehbuch in Sekunden-Abschnitten.`;
    case "caption":
      return `Schreibe 3 Caption-Varianten zum Thema. Jede Caption: erste Zeile = Hook, dann 2-4 kurze Zeilen, dann CTA. Genau 5 Hashtags pro Variante (Mix aus Nische und Reichweite).`;
    case "hooks":
      return `Schreibe ${Math.max(8, count)} Hooks für die ersten 2 Sekunden. Unterschiedliche Typen, kurz, sprechbar, ohne Clickbait-Lügen.`;
    case "calendar":
      return `Erstelle einen 7-Tage-Content-Plan mit konkreten Uhrzeiten (nutze die besten Zeitfenster aus den Metriken, sonst 11:30 / 17:30 / 20:00).`;
    case "hashtags":
      return `Stelle ein Hashtag-Set für die angegebene Nische oder das Thema zusammen: 8 bis 12 Nischen-Tags, 8 bis 12 Reichweiten-Tags und 3 bis 5 Marken-Tags, jeweils mit #, klein geschrieben, ohne Duplikate zwischen den Gruppen. Nimm nur Tags, die es auf TikTok wirklich gibt, gemischt aus deutschsprachigen und internationalen Tags. Liegt ein gescannter Account vor, baue dessen stärkste vorhandene Tags ein und begründe die Auswahl mit den Zahlen.`;
  }
}

export async function generate(
  mode: AiMode,
  payload: AiPayload,
  context: ScanContext | undefined,
  gate?: QualityGate | null,
) {
  const userPrompt = [
    modeInstruction(mode, payload),
    "",
    "ANGABEN DES NUTZERS:",
    payloadBlock(payload),
    "",
    "GESCRAPTE TIKTOK-DATEN:",
    contextBlock(context),
    "",
    "AUSGABE-SCHEMA (nur dieses JSON, keine Kommentare):",
    SCHEMAS[mode],
  ].join("\n");

  const guard = gate ? gateInstruction(gate) : "";

  const { text, model, usage, note } = await chat(
    [
      { role: "system", content: guard ? `${systemPrompt()}\n\n${guard}` : systemPrompt() },
      { role: "user", content: userPrompt },
    ],
    { json: true, temperature: mode === "hooks" || mode === "ideas" ? 0.85 : 0.7 },
  );

  const parsed = extractJson(text);
  recordAiCall(parsed === null);
  const issues = parsed === null ? [] : checkSchema(mode, parsed).slice(0, 6);
  return {
    mode,
    model,
    usage,
    note,
    issues,
    guard: gate && gate.level !== "ok" ? { level: gate.level, warning: gate.warning } : undefined,
    parsed: parsed !== null,
    result: parsed ?? { rohtext: text },
  };
}
