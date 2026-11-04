/**
 * Datenqualitaet eines Scans: pro Feld der Wert und wie sicher er ist. Damit
 * sieht man vor der KI-Auswertung, ob die Zahlen tragen oder duenn sind.
 *
 * Die Sicherheit kommt aus dem Parser: eine echte Zahl zaehlt 1, eine Zahl als
 * String 0.6, ein fehlendes oder leeres Feld 0. Fehlt die Angabe ganz (alte
 * Aufrufer, fremde Daten), faellt es auf 0 oder 1 zurueck.
 */

import { tr } from "./lang.ts";

export type FieldQuality = {
  field: string;
  value: number | null;
  source: "profile" | "videos";
  confidence: number;
};

export type DataQuality = {
  score: number;
  missing: string[];
  fields: FieldQuality[];
};

export type QualityLevel = "ok" | "thin" | "poor";

export type QualityGate = {
  level: QualityLevel;
  score: number;
  /** Modi, die bei dieser Datenlage gesperrt bleiben. */
  blocked: string[];
  warning: string;
};

/** Ab hier darf die KI arbeiten, aber nur mit markierten Annahmen. */
const THIN_BELOW = 0.7;
/** Darunter fehlen so viele Felder, dass Hooks und Hashtags geraten waeren. */
const POOR_BELOW = 0.4;
const NEEDS_DATA = ["hooks", "hashtags"];

type ProfileLike = {
  followers: number;
  nickname: string;
  avatar: string;
  confidence?: Record<string, number>;
};
type VideoLike = {
  views: number;
  likes: number;
  comments: number;
  durationSec: number;
  hashtags: string[];
  music: string;
  createdAt: number;
  confidence?: Record<string, number>;
};

const filled = (value: unknown): boolean =>
  typeof value === "number" ? Number.isFinite(value) && value > 0 : typeof value === "string" ? value.trim() !== "" : Boolean(value);

function field(
  name: string,
  source: "profile" | "videos",
  value: number | null,
  parsed: number | undefined,
  present: boolean,
): FieldQuality {
  const raw = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : present ? 1 : 0;
  return { field: name, value, source, confidence: Math.max(0, Math.min(1, raw)) };
}

export function assessQuality(input: { profile: ProfileLike; videos: VideoLike[] }): DataQuality {
  const { profile, videos } = input;
  const sample = videos[0];
  const p = profile.confidence;
  const s = sample?.confidence;

  const fields: FieldQuality[] = [
    field("followers", "profile", profile.followers, p?.followers, filled(profile.followers)),
    field("nickname", "profile", null, p?.nickname, filled(profile.nickname)),
    field("avatar", "profile", null, p?.avatar, filled(profile.avatar)),
    field("videos", "videos", videos.length, undefined, videos.length > 0),
    field("views", "videos", sample?.views ?? null, s?.views, !!sample && filled(sample.views)),
    field("likes", "videos", sample?.likes ?? null, s?.likes, !!sample && filled(sample.likes)),
    field("comments", "videos", sample?.comments ?? null, s?.comments, !!sample && filled(sample.comments)),
    field("duration", "videos", sample?.durationSec ?? null, s?.duration, !!sample && filled(sample.durationSec)),
    field("hashtags", "videos", sample?.hashtags.length ?? null, s?.hashtags, !!sample && sample.hashtags.length > 0),
    field("sound", "videos", null, s?.sound, !!sample && filled(sample.music)),
    field("createdAt", "videos", sample?.createdAt ?? null, s?.createdAt, !!sample && filled(sample.createdAt)),
  ];

  const score = fields.reduce((sum, entry) => sum + entry.confidence, 0) / fields.length;
  return {
    score: Math.round(score * 100) / 100,
    missing: fields.filter((entry) => entry.confidence === 0).map((entry) => entry.field),
    fields,
  };
}

/** Was die Datenlage fuer die KI-Auswertung bedeutet. */
export function qualityGate(quality: DataQuality): QualityGate {
  const level: QualityLevel = quality.score >= THIN_BELOW ? "ok" : quality.score >= POOR_BELOW ? "thin" : "poor";
  const percent = Math.round(quality.score * 100);

  const warning =
    level === "ok"
      ? ""
      : level === "thin"
        ? tr(
            `Datenlage ${percent} %: Empfehlungen beruhen teils auf Annahmen und sind als UNSICHER markiert.`,
            `Data quality ${percent}%: recommendations partly rest on assumptions and are marked UNSURE.`,
          )
        : tr(
            `Datenlage ${percent} %, zu duenn fuer Hooks und Hashtags. Erst scannen oder Video-Links ergaenzen.`,
            `Data quality ${percent}%, too thin for hooks and hashtags. Scan first or add video links.`,
          );

  return { level, score: quality.score, blocked: level === "poor" ? [...NEEDS_DATA] : [], warning };
}

/** Zusatz fuer den Systemprompt, leer bei guter Datenlage. */
export function gateInstruction(gate: QualityGate): string {
  if (gate.level === "ok") return "";
  const percent = Math.round(gate.score * 100);
  return gate.level === "poor"
    ? tr(
        `DATENLAGE (${percent} % vollstaendig): sehr duenn. Nenne keine konkreten Zahlen als Messwert und schreibe hinter jede Empfehlung UNSICHER.`,
        `DATA QUALITY (${percent}% complete): very thin. Do not state concrete measured numbers and append UNSURE to every recommendation.`,
      )
    : tr(
        `DATENLAGE (${percent} % vollstaendig): teilweise duenn. Wo eine Aussage auf Annahmen beruht, schreibe UNSICHER dahinter und erfinde keine Zahlen.`,
        `DATA QUALITY (${percent}% complete): partly thin. Append UNSURE to any claim that rests on assumptions and never invent numbers.`,
      );
}
