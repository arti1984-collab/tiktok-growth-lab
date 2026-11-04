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

export type ScanResult = {
  profile: Profile;
  videos: Video[];
  metrics: Metrics;
  warnings: string[];
  durationMs: number;
  scannedAt: number;
  timezone: string;
};

export type Status = {
  ok: boolean;
  version: string;
  language: "de" | "en";
  timezone: string;
  ai: { configured: boolean; baseUrl: string; model: string };
  server: { host: string; localOnly: boolean };
  scraping: { minDelayMs: number; cookieSet: boolean; cacheEntries: number };
};

export type PlanStatus = "planned" | "done" | "skipped";

export type PlanItem = {
  id: string;
  date: string;
  time: string;
  note: string;
  status: PlanStatus;
  videoUrl: string;
  createdAt: number;
  postedAt: number;
  actualViews: number;
  actualLikes: number;
};

/** Der Hintergrund-Download der neuen Windows-Datei. */
export type UpdateDownload = {
  state: "idle" | "downloading" | "ready" | "failed";
  version: string | null;
  received: number;
  total: number;
  percent: number;
  file: string | null;
  error: string | null;
};

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  url: string | null;
  exe: string | null;
  exeSize: number | null;
  notes: string;
  publishedAt: string | null;
  checkedAt: number;
  error: string | null;
  download: UpdateDownload | null;
};

export type Snapshot = {
  at: number;
  followers: number;
  following: number;
  hearts: number;
  videos: number;
  engagementRate: number | null;
  score: number | null;
};

export type Account = {
  handle: string;
  nickname: string;
  avatar: string;
  addedAt: number;
  latest: Snapshot | null;
  first: Snapshot | null;
  delta7: number | null;
  deltaAll: number | null;
  points: { at: number; followers: number }[];
  history: Snapshot[];
};

export type PublicSettings = {
  language: "de" | "en";
  aiBaseUrl: string;
  aiModel: string;
  hasApiKey: boolean;
  apiKeySource: "ui" | "env" | "none";
  cookieSet: boolean;
  cookieSource: "ui" | "env" | "none";
  minDelayMs: number;
  timezone: string;
  goalFollowers: number;
  goalDate: string;
};

export type ProviderModel = {
  id: string;
  label: string;
  note: string;
  json: "gut" | "ok";
};

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  keyUrl: string;
  free: boolean;
  recommended?: boolean;
  local?: boolean;
  freeNote: string;
  limits: string;
  models: ProviderModel[];
};

export type AiResponse = {
  mode: string;
  model: string;
  parsed: boolean;
  result: unknown;
  note?: string;
  /** Abweichungen vom erwarteten Schema, leer heisst: passt. */
  issues?: string[];
  /** Datenlage, auf der die Antwort beruht. */
  guard?: { level: "thin" | "poor"; warning: string };
};

export type FreeModel = {
  id: string;
  free: boolean | null;
  works: boolean | null;
  ms: number | null;
  note: string;
};

/** Ergebnis des Modell-Scanners: was kostenlos ist und was antwortet. */
export type FreeScan = {
  provider: string;
  baseUrl: string;
  rule: "pricing" | "tier" | "local" | "paid" | "unknown";
  checkedAt: number;
  total: number;
  probed: number;
  freeCount: number;
  models: FreeModel[];
};

export type AiMode = "strategy" | "audit" | "ideas" | "caption" | "hooks" | "calendar" | "hashtags";
