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
  /** Wie sicher die Zahlen gelesen wurden, 0 bis 1 je Feld. */
  confidence?: Record<string, number>;
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
  /** Wie sicher die Zahlen gelesen wurden, 0 bis 1 je Feld. */
  confidence?: Record<string, number>;
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

/** Zahl mit Sicherheit: echte Zahl 1, Zahl als String 0.6, alles andere 0. */
const numeric = (value: unknown): { value: number; confidence: number } => {
  if (typeof value === "number" && Number.isFinite(value)) return { value, confidence: 1 };
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return { value: parsed, confidence: 0.6 };
  }
  return { value: 0, confidence: 0 };
};

/** Text mit Sicherheit: gefuellter String 1, leer oder falscher Typ 0. */
const textValue = (value: unknown): { value: string; confidence: number } => {
  const parsed = toString(value).trim();
  return { value: parsed, confidence: parsed ? 1 : 0 };
};

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
  const parsed = parseProfileHtml(html!, handle);
  if (!parsed.profile) failFromResponse(html!, `@${handle}`);
  if (parsed.statusCode !== 0) {
    throw new TikTokError(
      "NOT_FOUND",
      tr(`@${handle} existiert nicht oder ist gesperrt.`, `@${handle} does not exist or is blocked.`),
    );
  }
  return parsed.profile;
}

export type ParsedProfile = { profile: Profile | null; statusCode: number };

/**
 * Profilseite auswerten, ohne Netz. So laesst sich der Parser mit gespeicherten
 * HTML-Seiten pruefen, statt fuer jeden Test TikTok zu fragen.
 */
export function parseProfileHtml(html: string, fallbackHandle: string): ParsedProfile {
  const scope = extractScope(html);
  const detail = scope?.["webapp.user-detail"] as Json | undefined;
  if (!detail) return { profile: null, statusCode: 0 };

  const statusCode = toNumber(detail.statusCode);
  const info = (detail.userInfo ?? {}) as Json;
  const user = (info.user ?? {}) as Json;
  const stats = (info.stats ?? {}) as Json;

  const nickname = textValue(user.nickname);
  const avatar = textValue(user.avatarLarger || user.avatarMedium || user.avatarThumb);
  const bio = textValue(user.signature);
  const region = textValue(user.region);
  const secUid = textValue(user.secUid);
  const followers = numeric(stats.followerCount);
  const following = numeric(stats.followingCount);
  const hearts = numeric(stats.heartCount ?? stats.heart);
  const videos = numeric(stats.videoCount);

  return {
    statusCode,
    profile: {
      id: toString(user.id),
      handle: toString(user.uniqueId) || fallbackHandle,
      nickname: nickname.value || fallbackHandle,
      bio: bio.value,
      avatar: avatar.value,
      verified: Boolean(user.verified),
      privateAccount: Boolean(user.privateAccount),
      region: region.value,
      secUid: secUid.value,
      followers: followers.value,
      following: following.value,
      hearts: hearts.value,
      videos: videos.value,
      url: `${WEB}/@${toString(user.uniqueId) || fallbackHandle}`,
      scrapedAt: Date.now(),
      confidence: {
        followers: followers.confidence,
        following: following.confidence,
        hearts: hearts.confidence,
        videos: videos.confidence,
        nickname: nickname.confidence,
        avatar: avatar.confidence,
        bio: bio.confidence,
        region: region.confidence,
        secUid: secUid.confidence,
      },
    },
  };
}

/**
 * The public creator list answers without a signature and returns up to 15 of
 * the newest videos with full stats. The list the web app itself calls
 * (post/item_list) is signed with X-Gnarly and answers with an empty body here.
 * Two app ids answer this endpoint, so a blocked or empty answer on the first
 * one is retried on the second. count=30 is rejected with HTTP 400, 15 is the
 * ceiling of this route.
 */
const CREATOR_LIST_LIMIT = 15;
const CREATOR_LIST_AIDS = [1988, 1180];

/** oEmbed answers without signature and tells us whether a video still exists. */
async function getOembed(url: string): Promise<{ title: string; author: string; thumbnail: string } | null> {
  try {
    const data = await fetchJson<{ title?: string; author_name?: string; thumbnail_url?: string }>(
      `${WEB}/oembed?url=${encodeURIComponent(url)}`,
      WEB,
    );
    return {
      title: toString(data.title),
      author: toString(data.author_name),
      thumbnail: toString(data.thumbnail_url),
    };
  } catch {
    return null;
  }
}

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
  const subject = tr(`die Videoliste von @${profile.handle}`, `the video list of @${profile.handle}`);
  let lastError: unknown = null;

  for (const [index, aid] of CREATOR_LIST_AIDS.entries()) {
    const url =
      `${WEB}/api/creator/item_list/?aid=${aid}` +
      `&secUid=${encodeURIComponent(profile.secUid)}&type=1&count=${count}&cursor=0`;
    try {
      const payload = await fetchJson<{ itemList?: Json[]; statusCode?: number }>(url, profile.url);
      const items = Array.isArray(payload.itemList) ? payload.itemList : [];
      const videos = items.map((item) => mapVideoItem(item, profile.handle)).filter((video) => video.id);
      if (videos.length > 0) return videos;
      lastError = new TikTokError(
        "PARSE",
        tr(`TikTok liefert für @${profile.handle} gerade keine Videoliste.`, `TikTok is returning no video list for @${profile.handle} right now.`),
      );
    } catch (error) {
      // A missing or blocked account will not get better on the second id.
      if (error instanceof HttpError && (error.status === 404 || error.status === 403)) {
        wrapHttpError(error, subject);
      }
      if (error instanceof TikTokError && error.code === "NOT_FOUND") throw error;
      lastError = error;
    }
    if (index < CREATOR_LIST_AIDS.length - 1) await sleep(2500);
  }

  if (lastError instanceof HttpError && lastError.status === 429) {
    throw new TikTokError(
      "RATE_LIMIT",
      tr("TikTok drosselt die Videoliste.", "TikTok is throttling the video list."),
      tr("Warte ein bis zwei Minuten und starte den Scan erneut.", "Wait a minute or two and run the scan again."),
    );
  }
  if (lastError instanceof Error) throw lastError;
  throw new TikTokError(
    "PARSE",
    tr(`TikTok liefert für @${profile.handle} gerade keine Videoliste.`, `TikTok is returning no video list for @${profile.handle} right now.`),
    tr(
      "Private Konten liefern keine Videos. Sonst später erneut scannen oder Links einfügen.",
      "Private accounts return no videos. Otherwise scan again later or add links.",
    ),
  );
}

/** Ein Eintrag aus der Videoliste, getrennt vom Netz und damit testbar. */
export function mapVideoItem(item: Json, fallbackHandle: string): Video {
  const stats = (item.stats ?? {}) as Json;
  const video = (item.video ?? {}) as Json;
  const music = (item.music ?? {}) as Json;
  const author = (item.author ?? {}) as Json;
  const authorStats = (item.authorStats ?? {}) as Json;
  const handle = toString(author.uniqueId) || fallbackHandle;
  const id = toString(item.id);
  const challenges = Array.isArray(item.challenges) ? (item.challenges as Json[]) : [];
  const hashtags = challenges.map((challenge) => toString(challenge.title)).filter(Boolean);

  const views = numeric(stats.playCount);
  const likes = numeric(stats.diggCount);
  const comments = numeric(stats.commentCount);
  const shares = numeric(stats.shareCount);
  const saves = numeric(stats.collectCount);
  const createdAt = numeric(item.createTime);
  const duration = numeric(video.duration);
  const musicTitle = textValue(music.title);
  const desc = textValue(item.desc);

  return {
    id,
    url: `${WEB}/@${handle}/video/${id}`,
    desc: desc.value,
    createdAt: createdAt.value,
    durationSec: duration.value,
    views: views.value,
    likes: likes.value,
    comments: comments.value,
    shares: shares.value,
    saves: saves.value,
    author: handle,
    authorFollowers: numeric(authorStats.followerCount).value,
    music: musicTitle.value,
    originalSound: Boolean(music.original) || /original sound/i.test(musicTitle.value),
    hashtags,
    thumbnail: toString(video.cover) || toString(video.dynamicCover) || toString(video.originCover),
    isAd: Boolean(item.isAd),
    confidence: {
      views: views.confidence,
      likes: likes.confidence,
      comments: comments.confidence,
      shares: shares.confidence,
      saves: saves.confidence,
      createdAt: createdAt.confidence,
      duration: duration.confidence,
      hashtags: hashtags.length > 0 ? 1 : 0,
      sound: musicTitle.confidence,
      desc: desc.confidence,
    },
  };
}

export async function getVideo(handle: string, id: string): Promise<Video> {
  const subject = tr(`das Video ${id}`, `video ${id}`);
  const first = `${WEB}/@${encodeURIComponent(handle)}/video/${id}?lang=${tr("de", "en")}`;
  let html: string;
  try {
    html = await fetchHtml(first, `${WEB}/@${handle}`);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) wrapHttpError(error, subject);
    // The same page in the other language often reaches a different cache node.
    const second = `${WEB}/@${encodeURIComponent(handle)}/video/${id}?lang=${tr("en", "de")}`;
    try {
      html = await fetchHtml(second, `${WEB}/@${handle}`);
    } catch {
      wrapHttpError(error, subject);
    }
  }
  const parsed = parseVideoHtml(html!, handle);
  if (!parsed.found) {
    // oEmbed has no numbers, but it tells a dead video from a blocked one.
    const meta = await getOembed(`${WEB}/@${handle}/video/${id}`);
    if (meta) {
      throw new TikTokError(
        "PARSE",
        tr(
          `Das Video von @${handle} existiert, TikTok gibt die Zahlen gerade nicht heraus.`,
          `The video by @${handle} exists, TikTok just does not hand out the numbers right now.`,
        ),
        tr(
          `Titel laut TikTok: ${meta.title.slice(0, 80) || "ohne Titel"}. Später erneut prüfen, oder den Scan wiederholen.`,
          `Title according to TikTok: ${meta.title.slice(0, 80) || "no title"}. Try again later or repeat the scan.`,
        ),
      );
    }
    failFromResponse(html!, subject);
  }

  if (!parsed.video) {
    throw new TikTokError(
      "NOT_FOUND",
      tr("TikTok liefert zu diesem Video keine Daten.", "TikTok returns no data for this video."),
      tr("Ist das Video noch online?", "Is the video still online?"),
    );
  }
  return parsed.video;
}

export type ParsedVideo = { found: boolean; video: Video | null };

/**
 * Videoseite auswerten, ohne Netz. found sagt, ob TikTok ueberhaupt einen
 * Block geliefert hat; video bleibt null, wenn der Eintrag darin fehlt.
 */
export function parseVideoHtml(html: string, fallbackHandle: string): ParsedVideo {
  const scope = extractScope(html);
  const detail = scope?.["webapp.video-detail"] as Json | undefined;
  if (!detail) return { found: false, video: null };

  const item = ((detail.itemInfo ?? {}) as Json).itemStruct as Json | undefined;
  if (!item) return { found: true, video: null };
  return { found: true, video: mapVideoItem(item, fallbackHandle) };
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
