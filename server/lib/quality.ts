/**
 * Datenqualitaet eines Scans: pro Feld der Wert und wie sicher er ist. Damit
 * sieht man vor der KI-Auswertung, ob die Zahlen tragen oder duenn sind.
 */

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

type ProfileLike = { followers: number; nickname: string; avatar: string };
type VideoLike = {
  views: number;
  likes: number;
  comments: number;
  durationSec: number;
  hashtags: string[];
  music: string;
  createdAt: number;
};

const filled = (value: unknown): boolean =>
  typeof value === "number" ? Number.isFinite(value) && value > 0 : typeof value === "string" ? value.trim() !== "" : Boolean(value);

export function assessQuality(input: { profile: ProfileLike; videos: VideoLike[] }): DataQuality {
  const { profile, videos } = input;
  const sample = videos[0];
  const fields: FieldQuality[] = [
    { field: "followers", value: profile.followers, source: "profile", confidence: filled(profile.followers) ? 1 : 0 },
    { field: "nickname", value: null, source: "profile", confidence: filled(profile.nickname) ? 1 : 0 },
    { field: "avatar", value: null, source: "profile", confidence: filled(profile.avatar) ? 1 : 0 },
    { field: "videos", value: videos.length, source: "videos", confidence: videos.length > 0 ? 1 : 0 },
    { field: "views", value: sample?.views ?? null, source: "videos", confidence: sample && filled(sample.views) ? 1 : 0 },
    { field: "likes", value: sample?.likes ?? null, source: "videos", confidence: sample && filled(sample.likes) ? 1 : 0 },
    { field: "comments", value: sample?.comments ?? null, source: "videos", confidence: sample && filled(sample.comments) ? 1 : 0 },
    { field: "duration", value: sample?.durationSec ?? null, source: "videos", confidence: sample && filled(sample.durationSec) ? 1 : 0 },
    { field: "hashtags", value: sample?.hashtags.length ?? null, source: "videos", confidence: sample && sample.hashtags.length > 0 ? 1 : 0 },
    { field: "sound", value: null, source: "videos", confidence: sample && filled(sample.music) ? 1 : 0 },
    { field: "createdAt", value: sample?.createdAt ?? null, source: "videos", confidence: sample && filled(sample.createdAt) ? 1 : 0 },
  ];

  const score = fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length;
  return {
    score: Math.round(score * 100) / 100,
    missing: fields.filter((field) => field.confidence === 0).map((field) => field.field),
    fields,
  };
}
