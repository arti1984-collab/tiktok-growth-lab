import type { Profile, Video } from "./tiktok.ts";

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
};

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const nf = new Intl.NumberFormat("de-DE");
const compact = new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 });
const percent = (value: number) => value.toFixed(1).replace(".", ",");

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
      insights: [
        {
          kind: "info",
          title: "Noch keine Post-Daten",
          text: `Füge 5–30 Video-Links von @${profile.handle} hinzu, damit Engagement, beste Posting-Zeiten und Formate berechnet werden können.`,
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
      title: "Bestes Zeitfenster",
      text: `Deine stärksten Posts laufen ${WEEKDAYS[best.weekday - 1]} (Ø ${compact.format(best.avgViews)} Views).${
        bestSlot ? ` Bestes Einzel-Zeitfenster: ${WEEKDAYS[bestSlot.weekday - 1]} um ${bestSlot.hour}:00 Uhr – Ø ${compact.format(bestSlot.avgViews)} Views aus ${bestSlot.posts} ${bestSlot.posts === 1 ? "Post" : "Posts"}.` : ""
      }`,
    });
  }

  const erVerdict =
    engagementRate >= 8 ? "sehr stark" : engagementRate >= 4.5 ? "solide" : engagementRate >= 2 ? "ausbaufähig" : "kritisch niedrig";
  insights.push({
    kind: engagementRate >= 4.5 ? "good" : "warn",
    title: `Engagement-Rate ${percent(engagementRate)} % – ${erVerdict}`,
    text: `Likes ${percent(likeRate)} % · Kommentare ${percent(commentRate)} % · Shares ${percent(shareRate)} % · Saves ${percent(saveRate)} % (Benchmark: 4,5 % gesamt). Shares und Saves sind 2026 die stärksten Reichweiten-Signale – hier lohnt Optimierung am meisten.`,
  });

  const reachVerdict =
    viewsPerFollower >= 2 ? "Du hast echte Reichweite über deine Follower hinaus." : viewsPerFollower >= 1 ? "Solide – der For You Feed greift." : "Deine Videos laufen vor allem im eigenen Follower-Kreis.";
  insights.push({
    kind: viewsPerFollower >= 1 ? "good" : "warn",
    title: `${viewsPerFollower.toFixed(2).replace(".", ",")} Views pro Follower`,
    text: `Ø ${compact.format(avgViews)} Views bei ${compact.format(profile.followers)} Followern. ${reachVerdict}`,
  });

  if (postsPerWeek !== null && avgDaysBetweenPosts !== null) {
    const pause = daysSinceLastPost !== null && daysSinceLastPost > 14;
    insights.push({
      kind: pause ? "warn" : postsPerWeek >= 2 ? "good" : "info",
      title: `Rhythmus: ${postsPerWeek.toFixed(1).replace(".", ",")} Posts/Woche`,
      text: `Ø alle ${avgDaysBetweenPosts.toFixed(1).replace(".", ",")} Tage ein Post. ${
        daysSinceLastPost !== null ? `Letzter Post vor ${Math.round(daysSinceLastPost)} Tagen.` : ""
      } ${pause ? "Lange Pausen kosten Reichweite – plane lieber kleine, regelmäßige Uploads." : ""}`,
    });
  }

  if (medianViews > 0) {
    insights.push({
      kind: outlierVideos.length > 0 ? "good" : "info",
      title: `${outlierVideos.length} von ${sampleSize} Videos laufen überdurchschnittlich`,
      text: `Dein bestes Video läuft ${bestMultiple.toFixed(1).replace(".", ",")}× so gut wie der Median (${compact.format(medianViews)} Views). Analysiere genau diese Videos und baue Serien daraus.`,
    });
  }

  const bestBucket = [...durationBuckets].filter((bucket) => bucket.posts > 0).sort((a, b) => b.avgViews - a.avgViews)[0];
  if (bestBucket) {
    insights.push({
      kind: "info",
      title: `Längen-Fenster: ${bestBucket.label}`,
      text: `In diesem Fenster holst du Ø ${compact.format(bestBucket.avgViews)} Views (${bestBucket.posts} Videos). Videos unter 3 Sekunden Hook-Retention verlieren – prüfe bei Flops die ersten 2 Sekunden.`,
    });
  }

  if (hashtags.length > 0) {
    const topTag = hashtags[0];
    insights.push({
      kind: "info",
      title: "Hashtag-Nutzung",
      text: `Am häufigsten: #${topTag.tag} (${topTag.posts}×, Ø ${compact.format(topTag.avgViews)} Views). Ø ${hookSignals.avgHashtags.toFixed(1).replace(".", ",")} Hashtags pro Video – 3 bis 5 passende Tags (Nische + Reichweite) reichen.`,
    });
  }

  insights.push({
    kind: hookSignals.originalSoundShare >= 50 ? "good" : "info",
    title: "Sound & Hook",
    text: `Ø Beschreibung ${hookSignals.avgDescLength} Zeichen, ${Math.round(hookSignals.questionShare)} % der Captions stellen eine Frage, ${Math.round(
      hookSignals.emojiShare,
    )} % nutzen Emojis, ${Math.round(hookSignals.originalSoundShare)} % Originalton. ${
      hookSignals.originalSoundShare >= 50 ? "Originalton ist gut für Wiedererkennung." : "Trend-Sounds können die Reichweite kurzfristig deutlich erhöhen."
    }`,
  });

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
    insights,
  };
}

export { WEEKDAYS, nf };
