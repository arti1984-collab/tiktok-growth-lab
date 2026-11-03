import fs from "node:fs";
import path from "node:path";
import express from "express";
import { DIST_DIR, HOST, IS_DEV, PORT, ROOT, isLoopbackHost } from "./config.ts";
import { computeMetrics, type Metrics } from "./lib/metrics.ts";
import { getProfile, normalizeHandle, scrapeVideos, TikTokError, type Profile, type Video } from "./lib/tiktok.ts";
import { AI_MODES, generate, type AiMode, type AiPayload } from "./lib/prompts.ts";
import { AiError, aiConfig, aiConfigured, listModels } from "./lib/ai.ts";
import {
  addSnapshot,
  effectiveSettings,
  listAccounts,
  publicSettings,
  trackAccount,
  untrackAccount,
  updateSettings,
  type Settings,
  type Snapshot,
  type TrackedAccount,
} from "./lib/store.ts";
import { cacheSize, clearCache } from "./lib/http.ts";
import { PROVIDERS } from "./lib/providers.ts";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

/**
 * Defends against DNS rebinding: a website that points its own domain at
 * 127.0.0.1 would otherwise reach this API from your browser. Only answers to
 * requests that were really addressed to localhost.
 */
const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
app.use((req, res, next) => {
  const hostname = (req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
  if (!ALLOWED_HOSTNAMES.has(hostname)) {
    res.status(403).json({
      error: "Dieser Server ist nur lokal erreichbar.",
      code: "LOCAL_ONLY",
      hint: `Öffne http://127.0.0.1:${PORT} auf diesem Rechner.`,
    });
    return;
  }
  next();
});

type ScanResult = {
  profile: Profile;
  videos: Video[];
  metrics: Metrics;
  warnings: string[];
  durationMs: number;
  scannedAt: number;
  timezone: string;
};

/** Last scan per handle – used to ground the AI in real numbers. */
const lastScans = new Map<string, ScanResult>();

const asyncHandler =
  (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    handler(req, res).catch(next);
  };

function splitInputs(input: string[]): string[] {
  return input
    .flatMap((value) => String(value).split(/[\s,;]+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function snapshotFrom(profile: Profile, metrics?: Metrics | null): Snapshot {
  return {
    at: Date.now(),
    followers: profile.followers,
    following: profile.following,
    hearts: profile.hearts,
    videos: profile.videos,
    engagementRate: metrics?.engagementRate ?? null,
    score: metrics?.score ?? null,
  };
}

function accountView(account: TrackedAccount) {
  const snapshots = account.snapshots;
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const first = snapshots.length > 0 ? snapshots[0] : null;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const reference = [...snapshots].reverse().find((snapshot) => snapshot.at <= weekAgo) ?? first;
  return {
    handle: account.handle,
    nickname: account.nickname,
    avatar: account.avatar,
    addedAt: account.addedAt,
    latest,
    first,
    delta7: latest && reference && reference.at !== latest.at ? latest.followers - reference.followers : null,
    deltaAll: latest && first ? latest.followers - first.followers : null,
    points: snapshots.map((snapshot) => ({ at: snapshot.at, followers: snapshot.followers })),
    // Full measurement series so the UI can open any single value over time.
    history: snapshots,
  };
}

/* ------------------------------------------------------------------ status */

app.get("/api/status", (_req, res) => {
  const config = aiConfig();
  const settings = effectiveSettings();
  res.json({
    ok: true,
    version: "1.0.0",
    timezone: settings.timezone,
    ai: { configured: aiConfigured(), baseUrl: config.baseUrl, model: config.model },
    server: { host: HOST, localOnly: isLoopbackHost(HOST) },
    scraping: {
      minDelayMs: settings.minDelayMs,
      cookieSet: Boolean(settings.cookie),
      cacheEntries: cacheSize(),
    },
  });
});

/* -------------------------------------------------------------------- scan */

app.post(
  "/api/scan",
  asyncHandler(async (req, res) => {
    const started = Date.now();
    const handle = normalizeHandle(String(req.body?.handle ?? ""));
    const rawUrls = Array.isArray(req.body?.videoUrls) ? req.body.videoUrls.map((value: unknown) => String(value)) : [];
    const urls = splitInputs(rawUrls).slice(0, 40);
    const timezone = effectiveSettings().timezone;

    const profile = await getProfile(handle);
    const warnings: string[] = [];

    const scraped = urls.length > 0 ? await scrapeVideos(urls) : { videos: [] as Video[], warnings: [] as string[] };
    warnings.push(...scraped.warnings);

    const own = scraped.videos.filter((video) => video.author.toLowerCase() === profile.handle.toLowerCase());
    if (scraped.videos.length > 0 && own.length === 0) {
      warnings.push("Kein Video gehört zu diesem Profil – die Analyse zeigt trotzdem die Performance der verlinkten Videos.");
    } else if (own.length > 0 && own.length < scraped.videos.length) {
      warnings.push(`${scraped.videos.length - own.length} Video(s) anderer Creator wurden nicht in die Metriken gerechnet.`);
    }

    const metrics = computeMetrics(profile, own.length > 0 ? own : scraped.videos, timezone);

    if (urls.length === 0) {
      warnings.push(
        "TikTok liefert die Post-Liste nicht mehr ohne Signatur. Profil-Stats wurden live gelesen – für Engagement, beste Zeiten und Top-Videos 5–40 Video-Links einfügen.",
      );
    }

    const result: ScanResult = {
      profile,
      videos: scraped.videos,
      metrics,
      warnings,
      durationMs: Date.now() - started,
      scannedAt: Date.now(),
      timezone,
    };
    lastScans.set(profile.handle.toLowerCase(), result);

    if (req.body?.track) {
      trackAccount(profile.handle, profile.nickname, profile.avatar);
      addSnapshot(profile.handle, snapshotFrom(profile, metrics));
    }

    res.json(result);
  }),
);

/** Most recent scan across all handles, so the UI keeps its context after a reload. */
app.get("/api/last-scan", (_req, res) => {
  const scans = [...lastScans.values()];
  if (scans.length === 0) {
    res.status(404).json({ error: "Es liegt noch kein Scan im Speicher." });
    return;
  }
  res.json(scans.reduce((newest, current) => (current.scannedAt > newest.scannedAt ? current : newest)));
});

app.get("/api/last-scan/:handle", (req, res) => {
  const handle = normalizeHandle(req.params.handle);
  const scan = lastScans.get(handle.toLowerCase());
  if (!scan) return res.status(404).json({ error: "Für diesen Account liegt kein Scan im Speicher." });
  res.json(scan);
});

/* ---------------------------------------------------------------------- AI */

app.post(
  "/api/ai",
  asyncHandler(async (req, res) => {
    const mode = String(req.body?.mode ?? "strategy") as AiMode;
    if (!AI_MODES.includes(mode)) {
      res.status(400).json({ error: `Unbekannter KI-Modus: ${mode}` });
      return;
    }
    const payload = (req.body?.payload ?? {}) as AiPayload;
    const handleRaw = req.body?.handle ? String(req.body.handle) : "";
    let context: ScanResult | undefined;
    if (handleRaw) {
      try {
        context = lastScans.get(normalizeHandle(handleRaw).toLowerCase());
      } catch {
        context = undefined;
      }
    }
    res.json(await generate(mode, payload, context));
  }),
);

app.get(
  "/api/ai/models",
  asyncHandler(async (_req, res) => {
    res.json({ models: await listModels() });
  }),
);

/** Model list for a key the user just pasted, before it is saved. */
app.post(
  "/api/ai/models",
  asyncHandler(async (req, res) => {
    const baseUrl = req.body?.aiBaseUrl ? String(req.body.aiBaseUrl) : undefined;
    const apiKey = req.body?.aiApiKey ? String(req.body.aiApiKey) : undefined;
    const models = await listModels({ baseUrl, apiKey });
    res.json({ models, free: models.filter((entry) => entry.endsWith(":free")) });
  }),
);

/** Curated free/paid provider presets shown in the settings view. */
app.get("/api/ai/providers", (_req, res) => {
  res.json({ providers: PROVIDERS });
});

/* --------------------------------------------------------------- watchlist */

app.get("/api/watchlist", (_req, res) => {
  res.json({ accounts: listAccounts().map(accountView) });
});

app.post(
  "/api/watchlist",
  asyncHandler(async (req, res) => {
    const profile = await getProfile(normalizeHandle(String(req.body?.handle ?? "")));
    trackAccount(profile.handle, profile.nickname, profile.avatar);
    const withSnapshot = addSnapshot(profile.handle, snapshotFrom(profile, null));
    if (!withSnapshot) {
      res.status(500).json({ error: "Account konnte nicht gespeichert werden." });
      return;
    }
    res.json({ account: accountView(withSnapshot), accounts: listAccounts().map(accountView) });
  }),
);

app.post(
  "/api/watchlist/refresh",
  asyncHandler(async (_req, res) => {
    const errors: { handle: string; message: string }[] = [];
    for (const account of listAccounts()) {
      try {
        const profile = await getProfile(account.handle);
        addSnapshot(profile.handle, snapshotFrom(profile, null));
      } catch (error) {
        errors.push({ handle: account.handle, message: error instanceof Error ? error.message : "Unbekannter Fehler" });
      }
    }
    res.json({ accounts: listAccounts().map(accountView), errors });
  }),
);

app.delete("/api/watchlist/:handle", (req, res) => {
  const removed = untrackAccount(req.params.handle);
  if (!removed) return res.status(404).json({ error: "Account ist nicht in der Watchlist." });
  res.json({ accounts: listAccounts().map(accountView) });
});

/* ---------------------------------------------------------------- settings */

app.get("/api/settings", (_req, res) => {
  res.json(publicSettings());
});

app.put("/api/settings", (req, res) => {
  const body = (req.body ?? {}) as Settings;
  res.json(updateSettings(body));
});

app.post("/api/cache/clear", (_req, res) => {
  clearCache();
  res.json({ ok: true, cacheEntries: 0 });
});

/* ------------------------------------------------------------ frontend/SPA */

async function start() {
  if (IS_DEV) {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) return next();
      try {
        const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set("content-type", "text/html").end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  } else {
    app.use(express.static(DIST_DIR));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      const indexFile = path.join(DIST_DIR, "index.html");
      if (!fs.existsSync(indexFile)) {
        res.status(503).type("text/plain").send("Frontend nicht gebaut. Bitte `npm run build` ausführen.");
        return;
      }
      res.sendFile(indexFile);
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: `Route nicht gefunden: ${req.method} ${req.path}` });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof TikTokError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "RATE_LIMIT"
            ? 429
            : error.code === "BLOCKED"
              ? 403
              : 502;
      res.status(status).json({ error: error.message, code: error.code, hint: error.hint });
      return;
    }
    if (error instanceof AiError) {
      const status =
        error.code === "NO_KEY"
          ? 428
          : error.code === "AUTH"
            ? 401
            : error.code === "RATE_LIMIT"
              ? 429
              : error.code === "OVERLOAD"
                ? 503
                : 502;
      res.status(status).json({ error: error.message, code: error.code, hint: error.hint });
      return;
    }
    console.error("[server]", error);
    res.status(500).json({ error: (error as Error)?.message || "Interner Serverfehler" });
  });

  app.listen(PORT, HOST, () => {
    const url = `http://${isLoopbackHost(HOST) ? "127.0.0.1" : HOST}:${PORT}`;
    console.log(`\n  TikTok Growth Lab läuft auf ${url}`);
    console.log(`  Nur lokal erreichbar: ${isLoopbackHost(HOST) ? "ja" : `nein (HOST=${HOST})`}`);
    console.log(`  Modus: ${IS_DEV ? "Entwicklung (Vite HMR)" : "Produktion"}`);
    console.log(`  KI: ${aiConfigured() ? `bereit (${aiConfig().model})` : "kein Key hinterlegt"}\n`);
  });
}

await start();
