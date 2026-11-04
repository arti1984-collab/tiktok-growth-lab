import { HttpError, fetchHtml, fetchJson, limiter, sleep } from "./http.ts";
import { tr } from "./lang.ts";

const WEB = "https://www.tiktok.com";

export type TikTokErrorCode = "NOT_FOUND" | "BLOCKED" | "RATE_LIMIT" | "NETWORK" | "PARSE";

export class TikTokError extends Error {
  code: TikTokErrorCode;
  hint: string;
  constructor(code: TikTokErrorCode, message: string, hint = "") {
    super(message);
    this.name = "TikTokError";
    this.code = code;
    this.hint = hint;
  }
}

export type Profile = {
  id: string;
  handle: string;
  nickname: string;
  bio: string;
  avatar: string;
  verified: boolean;
  privateAccount: boolean;
  region: string;
  secUid: string;
  followers: number;
  following: number;
  hearts: number;
  videos: number;
  url: string;
  scrapedAt: number;
};

export type Video = {
  id: string;
  url: string;
  desc: string;
  createdAt: number;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  author: string;
  authorFollowers: number;
  music: string;
  originalSound: boolean;
  hashtags: string[];
  thumbnail: string;
  isAd: boolean;
};

type Json = Record<string, unknown>;

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toString = (value: unknown): string => (typeof value === "string" ? value : "");

function extractScope(html: string): Json | null {
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { __DEFAULT_SCOPE__?: Json };
    return (parsed.__DEFAULT_SCOPE__ as Json) ?? null;
  } catch {
    return null;
  }
}

function failFromResponse(html: string, subject: string): never {
  if (/ratelimit triggered/i.test(html.slice(0, 200))) {
    throw new TikTokError(
      "RATE_LIMIT",
      tr("TikTok drosselt gerade (Rate-Limit).", "TikTok is throttling right now (rate limit)."),
      tr(
        "Warte 1–2 Minuten und starte den Scan erneut, oder erhöhe den Anfrage-Abstand in den Einstellungen.",
        "Wait 1–2 minutes and start the scan again, or raise the request delay in the settings.",
      ),
    );
  }
  if (/captcha|verify you are human|unusual traffic/i.test(html)) {
    throw new TikTokError(
      "BLOCKED",
      tr("TikTok verlangt eine Bestätigung (Captcha).", "TikTok asks for a confirmation (captcha)."),
      tr(
        "Öffne tiktok.com im Browser, löse das Captcha und hinterlege die Cookies in den Einstellungen.",
        "Open tiktok.com in a browser, solve the captcha and store the cookies in the settings.",
      ),
    );
  }
  if (/couldn't find this account|account doesn't exist|nicht gefunden/i.test(html)) {
    throw new TikTokError("NOT_FOUND", tr(`${subject} existiert nicht.`, `${subject} does not exist.`));
  }
  throw new TikTokError(
    "PARSE",
    tr(
      `TikTok hat für ${subject} keine verwertbaren Daten geliefert.`,
      `TikTok returned no usable data for ${subject}.`,
    ),
    tr(
      "Prüfe den Namen/die URL, oder hinterlege Cookies in den Einstellungen.",
      "Check the name/URL, or store cookies in the settings.",
    ),
  );
}

function wrapHttpError(error: unknown, subject: string): never {
  if (error instanceof TikTokError) throw error;
  if (error instanceof HttpError) {
    if (error.status === 404)
      throw new TikTokError("NOT_FOUND", tr(`${subject} existiert nicht.`, `${subject} does not exist.`));
    if (error.status === 403)
      throw new TikTokError(
        "BLOCKED",
        tr("TikTok blockt die Anfrage (403).", "TikTok blocked the request (403)."),
        tr("Hinterlege Cookies in den Einstellungen.", "Store cookies in the settings."),
      );
    if (error.status === 429)
      throw new TikTokError(
        "RATE_LIMIT",
        tr("TikTok drosselt die Anfragen.", "TikTok is throttling the requests."),
        tr("Kurz warten und erneut versuchen.", "Wait a moment and try again."),
      );
    throw new TikTokError("NETWORK", error.message, tr("Prüfe die Internetverbindung.", "Check your internet connection."));
  }
  throw new TikTokError(
    "NETWORK",
    (error as Error).message || tr("Unbekannter Netzwerkfehler.", "Unknown network error."),
  );
}

export function normalizeHandle(raw: string): string {
  const input = String(raw ?? "").trim();
  if (!input) throw new TikTokError("NOT_FOUND", tr("Bitte einen TikTok-Namen eingeben.", "Please enter a TikTok name."));

  const fromUrl = input.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
  if (fromUrl) return fromUrl[1];

  const cleaned = input.replace(/^@+/, "").split(/[?#/\s]/)[0];
  if (!/^[A-Za-z0-9._]{2,24}$/.test(cleaned)) {
    throw new TikTokError(
      "NOT_FOUND",
      tr(`"${input.slice(0, 40)}" ist kein gültiger TikTok-Name.`, `"${input.slice(0, 40)}" is not a valid TikTok name.`),
    );
  }
  return cleaned;
}

type VideoRef = { handle?: string; id: string } | { shortCode: string };

export function parseVideoRef(raw: string): VideoRef {
  const input = String(raw ?? "").trim();
  const short = input.match(/https?:\/\/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/i);
  if (short) return { shortCode: short[1] };

  const full = input.match(/tiktok\.com\/@([A-Za-z0-9._]+)\/(?:video|photo)\/(\d+)/i);
  if (full) return { handle: full[1], id: full[2] };

  const loose = input.match(/@([A-Za-z0-9._]+).*?(\d{16,20})/);
  if (loose) return { handle: loose[1], id: loose[2] };

  const idOnly = input.match(/^(\d{16,20})$/);
  if (idOnly) return { id: idOnly[1] };

  throw new TikTokError(
    "NOT_FOUND",
    tr(`Kein TikTok-Video-Link: ${input.slice(0, 60)}`, `Not a TikTok video link: ${input.slice(0, 60)}`),
  );
}

async function resolveShortLink(code: string): Promise<{ handle: string; id: string }> {
  const url = `https://vm.tiktok.com/${code}/`;
  const response = await limiter.run(async () =>
    fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Mozilla/5.0" } }),
  );
  const finalUrl = response.url || "";
  const match = finalUrl.match(/@([A-Za-z0-9._]+)\/(?:video|photo)\/(\d+)/i);
  if (match) return { handle: match[1], id: match[2] };
  throw new TikTokError(
    "NOT_FOUND",
    tr("Der Kurzlink ließ sich nicht auflösen.", "The short link could not be resolved."),
    tr("Nutze den vollständigen Video-Link.", "Use the full video link instead."),
  );
}

export async function getProfile(rawHandle: string): Promise<Profile> {
  const handle = normalizeHandle(rawHandle);
  let html: string;
  try {
    html = await fetchHtml(`${WEB}/@${encodeURIComponent(handle)}?lang=${tr("de", "en")}`);
  } catch (error) {
    wrapHttpError(error, `@${handle}`);
  }
  const scope = extractScope(html!);
  const detail = scope?.["webapp.user-detail"] as Json | undefined;
  if (!detail) failFromResponse(html!, `@${handle}`);

  const statusCode = toNumber(detail!.statusCode);
  if (statusCode !== 0) {
    throw new TikTokError(
      "NOT_FOUND",
      tr(`@${handle} existiert nicht oder ist gesperrt.`, `@${handle} does not exist or is blocked.`),
    );
  }

  const info = (detail!.userInfo ?? {}) as Json;
  const user = (info.user ?? {}) as Json;
  const stats = (info.stats ?? {}) as Json;

  return {
    id: toString(user.id),
    handle: toString(user.uniqueId) || handle,
    nickname: toString(user.nickname) || handle,
    bio: toString(user.signature),
    avatar: toString(user.avatarLarger) || toString(user.avatarMedium) || toString(user.avatarThumb),
    verified: Boolean(user.verified),
    privateAccount: Boolean(user.privateAccount),
    region: toString(user.region),
    secUid: toString(user.secUid),
    followers: toNumber(stats.followerCount),
    following: toNumber(stats.followingCount),
    hearts: toNumber(stats.heartCount ?? stats.heart),
    videos: toNumber(stats.videoCount),
    url: `${WEB}/@${toString(user.uniqueId) || handle}`,
    scrapedAt: Date.now(),
  };
}

/**
 * The public creator list answers without a signature and returns up to 15 of
 * the newest videos with full stats. The list the web app itself calls
 * (post/item_list) is signed with X-Gnarly and answers with an empty body here.
 */
const CREATOR_LIST_LIMIT = 15;

export async function getUserVideos(profile: Profile, limit = CREATOR_LIST_LIMIT): Promise<Video[]> {
  if (!profile.secUid) {
    throw new TikTokError(
      "PARSE",
      tr("Dieses Profil liefert keine secUid.", "This profile returns no secUid."),
      tr(
        "Starte den Scan erneut. Bleibt es dabei, ist das Profil gesperrt oder privat.",
        "Start the scan again. If it stays like this, the profile is blocked or private.",
      ),
    );
  }

  const count = Math.max(1, Math.min(CREATOR_LIST_LIMIT, Math.round(limit)));
  const url =
    `${WEB}/api/creator/item_list/?aid=1988` +
    `&secUid=${encodeURIComponent(profile.secUid)}&type=1&count=${count}&cursor=0`;

  let payload: { itemList?: Json[]; statusCode?: number };
  try {
    payload = await fetchJson<{ itemList?: Json[]; statusCode?: number }>(url, profile.url);
  } catch (error) {
    wrapHttpError(error, tr(`die Videoliste von @${profile.handle}`, `the video list of @${profile.handle}`));
  }

  const items = Array.isArray(payload!.itemList) ? payload!.itemList! : [];
  if (items.length === 0) {
    throw new TikTokError(
      "PARSE",
      tr(
        `TikTok liefert für @${profile.handle} gerade keine Videoliste.`,
        `TikTok is returning no video list for @${profile.handle} right now.`,
      ),
      tr(
        "Private Konten liefern keine Videos. Sonst später erneut scannen oder Links einfügen.",
        "Private accounts return no videos. Otherwise scan again later or add links.",
      ),
    );
  }
  return items.map((item) => mapVideo(item, profile.handle)).filter((video) => video.id);
}

function mapVideo(item: Json, fallbackHandle: string): Video {
  const stats = (item.stats ?? {}) as Json;
  const video = (item.video ?? {}) as Json;
  const music = (item.music ?? {}) as Json;
  const author = (item.author ?? {}) as Json;
  const authorStats = (item.authorStats ?? {}) as Json;
  const handle = toString(author.uniqueId) || fallbackHandle;
  const id = toString(item.id);
  const challenges = Array.isArray(item.challenges) ? (item.challenges as Json[]) : [];
  const hashtags = challenges.map((challenge) => toString(challenge.title)).filter(Boolean);

  return {
    id,
    url: `${WEB}/@${handle}/video/${id}`,
    desc: toString(item.desc),
    createdAt: toNumber(item.createTime),
    durationSec: toNumber(video.duration),
    views: toNumber(stats.playCount),
    likes: toNumber(stats.diggCount),
    comments: toNumber(stats.commentCount),
    shares: toNumber(stats.shareCount),
    saves: toNumber(stats.collectCount),
    author: handle,
    authorFollowers: toNumber(authorStats.followerCount),
    music: toString(music.title),
    originalSound: Boolean(music.original) || /original sound/i.test(toString(music.title)),
    hashtags,
    thumbnail: toString(video.cover) || toString(video.dynamicCover) || toString(video.originCover),
    isAd: Boolean(item.isAd),
  };
}

export async function getVideo(handle: string, id: string): Promise<Video> {
  const url = `${WEB}/@${encodeURIComponent(handle)}/video/${id}?lang=${tr("de", "en")}`;
  let html: string;
  try {
    html = await fetchHtml(url, `${WEB}/@${handle}`);
  } catch (error) {
    wrapHttpError(error, tr(`das Video ${id}`, `video ${id}`));
  }
  const scope = extractScope(html!);
  const detail = scope?.["webapp.video-detail"] as Json | undefined;
  if (!detail) failFromResponse(html!, tr(`das Video ${id}`, `video ${id}`));

  const item = ((detail!.itemInfo ?? {}) as Json).itemStruct as Json | undefined;
  if (!item) {
    throw new TikTokError(
      "NOT_FOUND",
      tr("TikTok liefert zu diesem Video keine Daten.", "TikTok returns no data for this video."),
      tr("Ist das Video noch online?", "Is the video still online?"),
    );
  }
  return mapVideo(item, handle);
}

/** Accepts any TikTok video URL (also short links) and returns the video data. */
export async function getVideoFromInput(raw: string): Promise<Video> {
  const ref = parseVideoRef(raw);
  if ("shortCode" in ref) {
    const resolved = await resolveShortLink(ref.shortCode);
    return getVideo(resolved.handle, resolved.id);
  }
  if (ref.handle) return getVideo(ref.handle, ref.id);

  // Only an ID was given – try to resolve the canonical URL.
  try {
    const response = await limiter.run(async () =>
      fetch(`${WEB}/v/${ref.id}`, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Mozilla/5.0" } }),
    );
    const match = (response.url || "").match(/@([A-Za-z0-9._]+)\/(?:video|photo)\/(\d+)/i);
    if (match) return getVideo(match[1], match[2]);
  } catch {
    // fall through to the error below
  }
  throw new TikTokError(
    "NOT_FOUND",
    tr(`Zu ${ref.id} fehlt der Creator-Name.`, `The creator name is missing for ${ref.id}.`),
    tr(
      "Kopiere den vollständigen Link, z. B. https://www.tiktok.com/@name/video/123…",
      "Copy the full link, for example https://www.tiktok.com/@name/video/123…",
    ),
  );
}

export async function scrapeVideos(
  inputs: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ videos: Video[]; warnings: string[] }> {
  const videos: Video[] = [];
  const warnings: string[] = [];
  const unique = [...new Set(inputs.map((input) => input.trim()).filter(Boolean))];

  for (let index = 0; index < unique.length; index += 1) {
    try {
      videos.push(await getVideoFromInput(unique[index]));
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Unbekannter Fehler", "Unknown error");
      warnings.push(`${unique[index].slice(0, 70)} → ${message}`);
      if (error instanceof TikTokError && error.code === "RATE_LIMIT") {
        // stop hammering, the remaining links would fail as well
        warnings.push(
          tr(
            "Scan abgebrochen: TikTok drosselt. Bitte später erneut versuchen.",
            "Scan stopped: TikTok is throttling. Please try again later.",
          ),
        );
        break;
      }
      await sleep(300);
    }
    onProgress?.(index + 1, unique.length);
  }
  return { videos, warnings };
}
