import type { Profile, Video } from "./tiktok.ts";
import { locale, tr } from "./lang.ts";

export type VideoSummary = {
  id: string;
  url: string;
  desc: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  createdAt: number;
  durationSec: number;
  engagementRate: number;
  thumbnail: string;
  multipleOfMedian: number;
};

export type Insight = { kind: "good" | "warn" | "info"; title: string; text: string };

/** Ein Punkt, der gerade bremst, mit dem konkreten naechsten Schritt. */
export type Weakness = {
  key: string;
  severity: "high" | "medium";
  title: string;
  problem: string;
  action: string;
};

export type Metrics = {
  hasData: boolean;
  sampleSize: number;
  score: number | null;
  engagementRate: number | null;
  likeRate: number | null;
  commentRate: number | null;
  shareRate: number | null;
  saveRate: number | null;
  avgViews: number;
  medianViews: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  viewsPerFollower: number | null;
  postsPerWeek: number | null;
  avgDaysBetweenPosts: number | null;
  daysSinceLastPost: number | null;
  avgDuration: number;
  bestSlots: { weekday: number; hour: number; avgViews: number; posts: number }[];
  weekdayPerf: { weekday: number; avgViews: number; posts: number }[];
  hourPerf: { hour: number; avgViews: number; posts: number }[];
  durationBuckets: { label: string; avgViews: number; posts: number; avgEngagement: number }[];
  hashtags: { tag: string; posts: number; avgViews: number }[];
  topVideos: VideoSummary[];
  flopVideos: VideoSummary[];
  outliers: { count: number; bestMultiple: number };
  hookSignals: {
    avgDescLength: number;
    questionShare: number;
    emojiShare: number;
    avgHashtags: number;
    originalSoundShare: number;
  };
  insights: Insight[];
  /** Was gerade bremst, dringend zuerst. Leer heisst: keine klare Schwaeche. */
  weaknesses: Weakness[];
};

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WEEKDAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const weekdayName = (weekday: number): string =>
  (locale() === "en-US" ? WEEKDAYS_EN : WEEKDAYS)[weekday - 1] ?? String(weekday);
const nf = () => new Intl.NumberFormat(locale());
const compact = () => new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 1 });
/** Fertiges Prozentzeichen inklusive Schreibweise: "4,5 %" oder "4.5%". */
const percent = (value: number) =>
  new Intl.NumberFormat(locale(), { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
const decimal = (value: number, digits = 2) =>
  new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const mean = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

/** Weekday (1 = Monday) and hour in the configured timezone. */
function localParts(unixSeconds: number, timezone: string): { weekday: number; hour: number } {
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(new Date(unixSeconds * 1000));
    const weekday = map[parts.find((part) => part.type === "weekday")?.value ?? "Mon"] ?? 1;
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    return { weekday, hour: Number.isFinite(hour) ? hour % 24 : 0 };
  } catch {
    const date = new Date(unixSeconds * 1000);
    return { weekday: date.getDay() === 0 ? 7 : date.getDay(), hour: date.getHours() };
  }
}

function engagementOf(video: Video): number {
  if (video.views <= 0) return 0;
  return ((video.likes + video.comments + video.shares + video.saves) / video.views) * 100;
}

function summarize(video: Video, medianViews: number): VideoSummary {
  return {
    id: video.id,
    url: video.url,
    desc: video.desc,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    shares: video.shares,
    saves: video.saves,
    createdAt: video.createdAt,
    durationSec: video.durationSec,
    engagementRate: engagementOf(video),
    thumbnail: video.thumbnail,
    multipleOfMedian: medianViews > 0 ? video.views / medianViews : 0,
  };
}

function groupPerformance(videos: Video[], timezone: string, mode: "weekday" | "hour" | "slot") {
  const buckets = new Map<string, { total: number; posts: number; weekday: number; hour: number }>();
  for (const video of videos) {
    const { weekday, hour } = localParts(video.createdAt, timezone);
    const key = mode === "weekday" ? String(weekday) : mode === "hour" ? String(hour) : `${weekday}-${hour}`;
    const bucket = buckets.get(key) ?? { total: 0, posts: 0, weekday, hour };
    bucket.total += video.views;
    bucket.posts += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((bucket) => ({
    weekday: bucket.weekday,
    hour: bucket.hour,
    posts: bucket.posts,
    avgViews: Math.round(bucket.total / bucket.posts),
  }));
}

const DURATION_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "≤ 15 s", min: 0, max: 15 },
  { label: "16–30 s", min: 16, max: 30 },
  { label: "31–60 s", min: 31, max: 60 },
  { label: "61–180 s", min: 61, max: 180 },
  { label: "> 180 s", min: 181, max: Number.MAX_SAFE_INTEGER },
];

function computeScore(input: {
  engagementRate: number;
  viewsPerFollower: number;
  postsPerWeek: number | null;
  daysSinceLastPost: number | null;
  outlierShare: number;
  bestMultiple: number;
}): number {
  const er = input.engagementRate;
  const engagement =
    er >= 8 ? 30 : er >= 6 ? 26 : er >= 4.5 ? 21 : er >= 3 ? 15 : er >= 1.5 ? 9 : 4;

  const vpf = input.viewsPerFollower;
  const reach = vpf >= 3 ? 25 : vpf >= 2 ? 22 : vpf >= 1 ? 17 : vpf >= 0.5 ? 11 : vpf >= 0.2 ? 7 : 2;

  const pfw = input.postsPerWeek ?? 0;
  let consistency = pfw >= 5 ? 25 : pfw >= 3 ? 21 : pfw >= 2 ? 16 : pfw >= 1 ? 11 : pfw >= 0.5 ? 7 : 2;
  if ((input.daysSinceLastPost ?? 0) > 21) consistency -= 8;
  else if ((input.daysSinceLastPost ?? 0) > 14) consistency -= 4;

  const share = input.outlierShare;
  let virality = share >= 0.3 ? 20 : share >= 0.2 ? 16 : share >= 0.1 ? 11 : share > 0 ? 6 : 1;
  if (input.bestMultiple >= 5) virality += 2;

  const total = engagement + reach + Math.max(0, consistency) + Math.min(20, virality);
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function computeMetrics(profile: Profile, videos: Video[], timezone: string): Metrics {
  const ownVideos = videos.filter((video) => video.views > 0);
  const sampleSize = ownVideos.length;

  if (sampleSize === 0) {
    return {
      hasData: false,
      sampleSize: 0,
      score: null,
      engagementRate: null,
      likeRate: null,
      commentRate: null,
      shareRate: null,
      saveRate: null,
      avgViews: 0,
      medianViews: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalSaves: 0,
      viewsPerFollower: null,
      postsPerWeek: null,
      avgDaysBetweenPosts: null,
      daysSinceLastPost: null,
      avgDuration: 0,
      bestSlots: [],
      weekdayPerf: [],
      hourPerf: [],
      durationBuckets: [],
      hashtags: [],
      topVideos: [],
      flopVideos: [],
      outliers: { count: 0, bestMultiple: 0 },
      hookSignals: { avgDescLength: 0, questionShare: 0, emojiShare: 0, avgHashtags: 0, originalSoundShare: 0 },
      weaknesses: [],
      insights: [
        {
          kind: "info",
          title: tr("Noch keine Post-Daten", "No post data yet"),
          text: tr(
            `Füge 5–30 Video-Links von @${profile.handle} hinzu, damit Engagement, beste Posting-Zeiten und Formate berechnet werden können.`,
            `Add 5–30 video links for @${profile.handle} so engagement, best posting times and formats can be calculated.`,
          ),
        },
      ],
    };
  }

  const totalViews = ownVideos.reduce((sum, video) => sum + video.views, 0);
  const totalLikes = ownVideos.reduce((sum, video) => sum + video.likes, 0);
  const totalComments = ownVideos.reduce((sum, video) => sum + video.comments, 0);
  const totalShares = ownVideos.reduce((sum, video) => sum + video.shares, 0);
  const totalSaves = ownVideos.reduce((sum, video) => sum + video.saves, 0);

  const avgViews = Math.round(totalViews / sampleSize);
  const medianViews = Math.round(median(ownVideos.map((video) => video.views)));
  const engagementRate = (totalViews === 0 ? 0 : ((totalLikes + totalComments + totalShares + totalSaves) / totalViews) * 100);
  const likeRate = totalViews === 0 ? 0 : (totalLikes / totalViews) * 100;
  const commentRate = totalViews === 0 ? 0 : (totalComments / totalViews) * 100;
  const shareRate = totalViews === 0 ? 0 : (totalShares / totalViews) * 100;
  const saveRate = totalViews === 0 ? 0 : (totalSaves / totalViews) * 100;
  const viewsPerFollower = profile.followers > 0 ? avgViews / profile.followers : 0;

  const sortedByDate = [...ownVideos].sort((a, b) => a.createdAt - b.createdAt);
  const gaps: number[] = [];
  for (let index = 1; index < sortedByDate.length; index += 1) {
    gaps.push((sortedByDate[index].createdAt - sortedByDate[index - 1].createdAt) / 86_400);
  }
  const avgDaysBetweenPosts = gaps.length > 0 ? mean(gaps) : null;
  const postsPerWeek = avgDaysBetweenPosts && avgDaysBetweenPosts > 0 ? 7 / avgDaysBetweenPosts : null;
  const newest = sortedByDate[sortedByDate.length - 1];
  const daysSinceLastPost = newest ? (Date.now() / 1000 - newest.createdAt) / 86_400 : null;

  const avgDuration = Math.round(mean(ownVideos.map((video) => video.durationSec)));

  const byViews = [...ownVideos].sort((a, b) => b.views - a.views);
  const topVideos = byViews.slice(0, 5).map((video) => summarize(video, medianViews));
  const flopVideos = byViews
    .slice(-3)
    .reverse()
    .filter((video) => !topVideos.some((top) => top.id === video.id))
    .map((video) => summarize(video, medianViews));

  const outlierVideos = medianViews > 0 ? ownVideos.filter((video) => video.views >= medianViews * 2) : [];
  const bestMultiple = topVideos.length > 0 ? topVideos[0].multipleOfMedian : 0;

  const durationBuckets = DURATION_BUCKETS.map((bucket) => {
    const inside = ownVideos.filter((video) => video.durationSec >= bucket.min && video.durationSec <= bucket.max);
    return {
      label: bucket.label,
      posts: inside.length,
      avgViews: inside.length > 0 ? Math.round(mean(inside.map((video) => video.views))) : 0,
      avgEngagement: inside.length > 0 ? mean(inside.map(engagementOf)) : 0,
    };
  });

  const tagMap = new Map<string, { posts: number; total: number }>();
  for (const video of ownVideos) {
    for (const tag of new Set(video.hashtags.map((value) => value.toLowerCase()))) {
      const entry = tagMap.get(tag) ?? { posts: 0, total: 0 };
      entry.posts += 1;
      entry.total += video.views;
      tagMap.set(tag, entry);
    }
  }
  const hashtags = [...tagMap.entries()]
    .map(([tag, entry]) => ({ tag, posts: entry.posts, avgViews: Math.round(entry.total / entry.posts) }))
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 12);

  const emojiPattern = /\p{Extended_Pictographic}/u;
  const hookSignals = {
    avgDescLength: Math.round(mean(ownVideos.map((video) => video.desc.length))),
    questionShare: (ownVideos.filter((video) => video.desc.includes("?")).length / sampleSize) * 100,
    emojiShare: (ownVideos.filter((video) => emojiPattern.test(video.desc)).length / sampleSize) * 100,
    avgHashtags: mean(ownVideos.map((video) => video.hashtags.length)),
    originalSoundShare: (ownVideos.filter((video) => video.originalSound).length / sampleSize) * 100,
  };

  const slots = groupPerformance(ownVideos, timezone, "slot").sort((a, b) => b.avgViews - a.avgViews);
  const weekdayPerf = groupPerformance(ownVideos, timezone, "weekday").sort((a, b) => b.avgViews - a.avgViews);
  const hourPerf = groupPerformance(ownVideos, timezone, "hour").sort((a, b) => b.avgViews - a.avgViews);

  const score = computeScore({
    engagementRate,
    viewsPerFollower,
    postsPerWeek,
    daysSinceLastPost,
    outlierShare: sampleSize > 0 ? outlierVideos.length / sampleSize : 0,
    bestMultiple,
  });

  const insights: Insight[] = [];

  if (weekdayPerf.length > 0) {
    const best = weekdayPerf[0];
    const bestSlot = slots[0];
    insights.push({
      kind: "info",
      title: tr("Bestes Zeitfenster", "Best time window"),
      text: tr(
        `Deine stärksten Posts laufen ${weekdayName(best.weekday)} (Ø ${compact().format(best.avgViews)} Views).${
          bestSlot
            ? ` Bestes Einzel-Zeitfenster: ${weekdayName(bestSlot.weekday)} um ${bestSlot.hour}:00 Uhr – Ø ${compact().format(
                bestSlot.avgViews,
              )} Views aus ${bestSlot.posts} ${bestSlot.posts === 1 ? "Post" : "Posts"}.`
            : ""
        }`,
        `Your strongest posts run on ${weekdayName(best.weekday)} (Ø ${compact().format(best.avgViews)} views).${
          bestSlot
            ? ` Best single window: ${weekdayName(bestSlot.weekday)} at ${bestSlot.hour}:00, Ø ${compact().format(
                bestSlot.avgViews,
              )} views from ${bestSlot.posts} post${bestSlot.posts === 1 ? "" : "s"}.`
            : ""
        }`,
      ),
    });
  }

  const erVerdict = tr(
    engagementRate >= 8 ? "sehr stark" : engagementRate >= 4.5 ? "solide" : engagementRate >= 2 ? "ausbaufähig" : "kritisch niedrig",
    engagementRate >= 8 ? "very strong" : engagementRate >= 4.5 ? "solid" : engagementRate >= 2 ? "room to grow" : "critically low",
  );
  insights.push({
    kind: engagementRate >= 4.5 ? "good" : "warn",
    title: tr(`Engagement-Rate ${percent(engagementRate)} – ${erVerdict}`, `Engagement rate ${percent(engagementRate)} – ${erVerdict}`),
    text: tr(
      `Likes ${percent(likeRate)} · Kommentare ${percent(commentRate)} · Shares ${percent(shareRate)} · Saves ${percent(saveRate)} (Benchmark: 4,5 % gesamt). Shares und Saves sind 2026 die stärksten Reichweiten-Signale – hier lohnt Optimierung am meisten.`,
      `Likes ${percent(likeRate)} · comments ${percent(commentRate)} · shares ${percent(shareRate)} · saves ${percent(saveRate)} (benchmark: 4.5% overall). Shares and saves are the strongest reach signals in 2026, so this is where tuning pays off most.`,
    ),
  });

  const reachVerdict = tr(
    viewsPerFollower >= 2
      ? "Du hast echte Reichweite über deine Follower hinaus."
      : viewsPerFollower >= 1
        ? "Solide – der For You Feed greift."
        : "Deine Videos laufen vor allem im eigenen Follower-Kreis.",
    viewsPerFollower >= 2
      ? "You reach well beyond your own followers."
      : viewsPerFollower >= 1
        ? "Solid – the For You feed is picking it up."
        : "Your videos mostly run inside your own follower circle.",
  );
  insights.push({
    kind: viewsPerFollower >= 1 ? "good" : "warn",
    title: tr(`${decimal(viewsPerFollower)} Views pro Follower`, `${decimal(viewsPerFollower)} views per follower`),
    text: tr(
      `Ø ${compact().format(avgViews)} Views bei ${compact().format(profile.followers)} Followern. ${reachVerdict}`,
      `Ø ${compact().format(avgViews)} views with ${compact().format(profile.followers)} followers. ${reachVerdict}`,
    ),
  });

  if (postsPerWeek !== null && avgDaysBetweenPosts !== null) {
    const pause = daysSinceLastPost !== null && daysSinceLastPost > 14;
    insights.push({
      kind: pause ? "warn" : postsPerWeek >= 2 ? "good" : "info",
      title: tr(`Rhythmus: ${decimal(postsPerWeek, 1)} Posts/Woche`, `Cadence: ${decimal(postsPerWeek, 1)} posts/week`),
      text: tr(
        `Ø alle ${decimal(avgDaysBetweenPosts, 1)} Tage ein Post. ${
          daysSinceLastPost !== null ? `Letzter Post vor ${Math.round(daysSinceLastPost)} Tagen.` : ""
        } ${pause ? "Lange Pausen kosten Reichweite – plane lieber kleine, regelmäßige Uploads." : ""}`,
        `One post every ${decimal(avgDaysBetweenPosts, 1)} days on average. ${
          daysSinceLastPost !== null ? `Last post ${Math.round(daysSinceLastPost)} days ago.` : ""
        } ${pause ? "Long breaks cost reach, so plan small, regular uploads instead." : ""}`,
      ),
    });
  }

  if (medianViews > 0) {
    insights.push({
      kind: outlierVideos.length > 0 ? "good" : "info",
      title: tr(
        `${outlierVideos.length} von ${sampleSize} Videos laufen überdurchschnittlich`,
        `${outlierVideos.length} of ${sampleSize} videos beat the average`,
      ),
      text: tr(
        `Dein bestes Video läuft ${decimal(bestMultiple, 1)}× so gut wie der Median (${compact().format(medianViews)} Views). Analysiere genau diese Videos und baue Serien daraus.`,
        `Your best video does ${decimal(bestMultiple, 1)}× the median (${compact().format(medianViews)} views). Study exactly those videos and turn them into series.`,
      ),
    });
  }

  const bestBucket = [...durationBuckets].filter((bucket) => bucket.posts > 0).sort((a, b) => b.avgViews - a.avgViews)[0];
  if (bestBucket) {
    insights.push({
      kind: "info",
      title: tr(`Längen-Fenster: ${bestBucket.label}`, `Length window: ${bestBucket.label}`),
      text: tr(
        `In diesem Fenster holst du Ø ${compact().format(bestBucket.avgViews)} Views (${bestBucket.posts} Videos). Videos unter 3 Sekunden Hook-Retention verlieren – prüfe bei Flops die ersten 2 Sekunden.`,
        `This window brings Ø ${compact().format(bestBucket.avgViews)} views (${bestBucket.posts} videos). Videos that lose hook retention under 3 seconds drop off, so check the first 2 seconds of every flop.`,
      ),
    });
  }

  if (hashtags.length > 0) {
    const topTag = hashtags[0];
    insights.push({
      kind: "info",
      title: tr("Hashtag-Nutzung", "Hashtag usage"),
      text: tr(
        `Am häufigsten: #${topTag.tag} (${topTag.posts}×, Ø ${compact().format(topTag.avgViews)} Views). Ø ${decimal(
          hookSignals.avgHashtags,
          1,
        )} Hashtags pro Video – 3 bis 5 passende Tags (Nische + Reichweite) reichen.`,
        `Most used: #${topTag.tag} (${topTag.posts}×, Ø ${compact().format(topTag.avgViews)} views). Ø ${decimal(
          hookSignals.avgHashtags,
          1,
        )} hashtags per video; 3 to 5 fitting tags (niche plus reach) are enough.`,
      ),
    });
  }

  insights.push({
    kind: hookSignals.originalSoundShare >= 50 ? "good" : "info",
    title: "Sound & Hook",
    text: tr(
      `Ø Beschreibung ${hookSignals.avgDescLength} Zeichen, ${Math.round(hookSignals.questionShare)} % der Captions stellen eine Frage, ${Math.round(
        hookSignals.emojiShare,
      )} % nutzen Emojis, ${Math.round(hookSignals.originalSoundShare)} % Originalton. ${
        hookSignals.originalSoundShare >= 50 ? "Originalton ist gut für Wiedererkennung." : "Trend-Sounds können die Reichweite kurzfristig deutlich erhöhen."
      }`,
      `Ø caption length ${hookSignals.avgDescLength} characters, ${Math.round(
        hookSignals.questionShare,
      )}% of captions ask a question, ${Math.round(hookSignals.emojiShare)}% use emojis, ${Math.round(
        hookSignals.originalSoundShare,
      )}% original sound. ${
        hookSignals.originalSoundShare >= 50 ? "Original sound helps recognition." : "Trend sounds can lift reach noticeably for a short time."
      }`,
    ),
  });

  // Die eigentliche Antwort auf "wo hakt es": jede Zeile nennt die Zahl, den
  // Grund und den naechsten Schritt. Nur was aus den Daten wirklich folgt.
  const weaknesses: Weakness[] = [];
  const bestSlot = slots[0];

  if (engagementRate < 4.5) {
    const signals: { name: string; value: number; advice: [string, string] }[] = [
      {
        name: tr("Kommentare", "comments"),
        value: commentRate,
        advice: [
          "Stelle in den ersten zwei Sekunden eine Frage und antworte in der ersten halben Stunde auf jeden Kommentar.",
          "Ask a question in the first two seconds and answer every comment within the first half hour.",
        ],
      },
      {
        name: tr("Saves", "saves"),
        value: saveRate,
        advice: [
          "Gib einen Grund zum Speichern: eine Checkliste, drei Schritte oder ein Vorher-Nachher, das man wiederfinden will.",
          "Give a reason to save: a checklist, three steps or a before-and-after worth finding again.",
        ],
      },
      {
        name: tr("Shares", "shares"),
        value: shareRate,
        advice: [
          "Baue einen Satz ein, den man weiterleitet: eine überraschende Zahl oder eine klare Meinung.",
          "Add a line worth forwarding: a surprising number or a clear opinion.",
        ],
      },
    ];
    const weakest = [...signals].sort((a, b) => a.value - b.value)[0];
    weaknesses.push({
      key: "engagement",
      severity: engagementRate < 2 ? "high" : "medium",
      title: tr("Zu wenig Interaktion pro View", "Too little interaction per view"),
      problem: tr(
        `Die Engagement-Rate liegt bei ${percent(engagementRate)}, der Vergleichswert bei 4,5 %. Am schwächsten sind ${weakest.name} mit ${percent(weakest.value)}.`,
        `The engagement rate is ${percent(engagementRate)} against a benchmark of 4.5%. Weakest are ${weakest.name} at ${percent(weakest.value)}.`,
      ),
      action: locale() === "en-US" ? weakest.advice[1] : weakest.advice[0],
    });
  }

  if (viewsPerFollower < 1) {
    weaknesses.push({
      key: "reach",
      severity: "high",
      title: tr("Reichweite bleibt im Follower-Kreis", "Reach stays inside your followers"),
      problem: tr(
        `Ø ${compact().format(avgViews)} Views bei ${compact().format(profile.followers)} Followern, das sind ${decimal(
          viewsPerFollower,
        )} Views pro Follower. Ab etwa 1,0 zeigt TikTok das Video auch Leuten, die dir nicht folgen.`,
        `Ø ${compact().format(avgViews)} views with ${compact().format(profile.followers)} followers, that is ${decimal(
          viewsPerFollower,
        )} views per follower. From about 1.0 TikTok shows the video to people who do not follow you.`,
      ),
      action: bestSlot
        ? tr(
            `Nutze zuerst ${weekdayName(bestSlot.weekday)} um ${bestSlot.hour}:00, dein stärkstes Fenster, und teste dort drei verschiedene Hooks.`,
            `Use ${weekdayName(bestSlot.weekday)} at ${bestSlot.hour}:00 first, your strongest window, and test three different hooks there.`,
          )
        : tr(
            "Poste zu deinen stärksten Zeiten und teste drei verschiedene Hooks pro Woche.",
            "Post at your strongest times and test three different hooks per week.",
          ),
    });
  }

  if (postsPerWeek !== null && (postsPerWeek < 2 || (daysSinceLastPost ?? 0) > 14)) {
    weaknesses.push({
      key: "cadence",
      severity: (daysSinceLastPost ?? 0) > 14 ? "high" : "medium",
      title: tr("Unregelmäßiger Rhythmus", "Irregular cadence"),
      problem: tr(
        `Ø ${decimal(postsPerWeek, 1)} Posts pro Woche, ein Post alle ${decimal(avgDaysBetweenPosts ?? 0, 1)} Tage${
          daysSinceLastPost !== null ? `, der letzte vor ${Math.round(daysSinceLastPost)} Tagen` : ""
        }. TikTok verteilt Reichweite an Konten, die verlässlich liefern.`,
        `Ø ${decimal(postsPerWeek, 1)} posts per week, one every ${decimal(avgDaysBetweenPosts ?? 0, 1)} days${
          daysSinceLastPost !== null ? `, the last one ${Math.round(daysSinceLastPost)} days ago` : ""
        }. TikTok hands reach to accounts that show up reliably.`,
      ),
      action: tr(
        "Plane drei Posts pro Woche fest ein, jeden in einem deiner stärksten Zeitfenster.",
        "Block three posts per week, each in one of your strongest windows.",
      ),
    });
  }

  if (hookSignals.originalSoundShare < 50) {
    weaknesses.push({
      key: "sound",
      severity: "medium",
      title: tr("Wenig Originalton", "Little original sound"),
      problem: tr(
        `Nur ${Math.round(hookSignals.originalSoundShare)} % deiner Videos laufen mit Originalton. Trend-Sounds erreichen kurzfristig mehr Leute.`,
        `Only ${Math.round(hookSignals.originalSoundShare)}% of your videos use original sound. Trend sounds reach more people for a short time.`,
      ),
      action: tr(
        "Nimm pro Woche ein Video mit einem aktuellen Sound auf und behalte deinen eigenen Ton für die übrigen.",
        "Record one video a week with a current sound and keep your own audio for the rest.",
      ),
    });
  }

  if (sampleSize < 8) {
    weaknesses.push({
      key: "sample",
      severity: "medium",
      title: tr("Dünne Datenbasis", "Thin data base"),
      problem: tr(
        `Nur ${sampleSize} Videos mit Views. Aus so wenigen Posts lassen sich Zeiten und Formate nicht sicher ableiten.`,
        `Only ${sampleSize} videos with views. Times and formats cannot be derived reliably from that few posts.`,
      ),
      action: tr(
        "Füge oben im Scan weitere Video-Links ein, dann rechnet der nächste Scan mit mehr Posts.",
        "Add more video links in the scan above, then the next scan works with more posts.",
      ),
    });
  }

  weaknesses.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));

  return {
    hasData: true,
    sampleSize,
    score,
    engagementRate,
    likeRate,
    commentRate,
    shareRate,
    saveRate,
    avgViews,
    medianViews,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    viewsPerFollower,
    postsPerWeek,
    avgDaysBetweenPosts,
    daysSinceLastPost,
    avgDuration,
    bestSlots: slots.slice(0, 6),
    weekdayPerf,
    hourPerf,
    durationBuckets,
    hashtags,
    topVideos,
    flopVideos,
    outliers: { count: outlierVideos.length, bestMultiple },
    hookSignals,
    weaknesses,
    insights,
  };
}

export { WEEKDAYS, nf };
