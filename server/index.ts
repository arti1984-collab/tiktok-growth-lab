import fs from "node:fs";
import path from "node:path";
import express from "express";
import { APP_VERSION, DIST_DIR, HOST, IS_DEV, PORT, ROOT, isLoopbackHost } from "./config.ts";
import { computeMetrics, type Metrics } from "./lib/metrics.ts";
import {
  getProfile,
  getUserVideos,
  getVideoFromInput,
  normalizeHandle,
  scrapeVideos,
  TikTokError,
  type Profile,
  type Video,
} from "./lib/tiktok.ts";
import { AI_MODES, generate, type AiMode, type AiPayload } from "./lib/prompts.ts";
import { AiError, aiConfig, aiConfigured, listModels } from "./lib/ai.ts";
import { scanFreeModels } from "./lib/modelScan.ts";
import { normalizeScanInput } from "./lib/scanInput.ts";
import { assessQuality, qualityGate } from "./lib/quality.ts";
import { outcomesFrom, summarizePlan, type PlanFeedback } from "./lib/feedback.ts";
import { diagnostics, recordFailure, recordScan, recordScanStart } from "./lib/stats.ts";
import {
  addPlan,
  addSnapshot,
  deletePlanEntry,
  effectiveSettings,
  listPlan,
  updatePlanEntry,
  listAccounts,
  publicSettings,
  trackAccount,
  untrackAccount,
  updateSettings,
  type Settings,
  type Snapshot,
  type TrackedAccount,
} from "./lib/store.ts";
import { browserFallbackAvailable, browserProbe, cacheSize, clearCache } from "./lib/http.ts";
import { PROVIDERS } from "./lib/providers.ts";
import { setLang, tr } from "./lib/lang.ts";
import { checkForUpdate, currentVersion, probeRepoAccess } from "./lib/update.ts";
import { downloadInfo, startDownload } from "./lib/updater.ts";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

/** Every response follows the language stored in the settings. */
app.use((_req, _res, next) => {
  setLang(effectiveSettings().language);
  next();
});

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
      error: tr("Dieser Server ist nur lokal erreichbar.", "This server is only reachable locally."),
      code: "LOCAL_ONLY",
      hint: tr(`Öffne http://127.0.0.1:${PORT} auf diesem Rechner.`, `Open http://127.0.0.1:${PORT} on this computer.`),
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

/** Der juengste Scan ist die Messlatte fuer die eigenen Posts. */
function newestScan(): ScanResult | null {
  const scans = [...lastScans.values()];
  return scans.length > 0
    ? scans.reduce((newest, current) => (current.scannedAt > newest.scannedAt ? current : newest))
    : null;
}

function planFeedback(): PlanFeedback {
  return summarizePlan(outcomesFrom(listPlan(), newestScan()));
}

/** Plan und Ergebnis-Check gehoeren zusammen, sonst zeigt die Karte alte Zahlen. */
function planPayload() {
  return { items: listPlan(), feedback: planFeedback() };
}

const RESULT_REFRESH_LIMIT = 4;

/**
 * Erledigte Plan-Posts selbst nachmessen: die Video-URL steht im Eintrag, die
 * Zahlen kommen von TikTok. Damit muss niemand Views abtippen, und die Frage
 * "haelt mein Slot?" beruht auf Messungen statt auf Erinnerung.
 */
async function refreshPlanResults(): Promise<number> {
  const due = listPlan().filter((item) => item.status === "done" && item.videoUrl.trim() !== "");
  let updated = 0;
  for (const item of due.slice(0, RESULT_REFRESH_LIMIT)) {
    try {
      const video = await getVideoFromInput(item.videoUrl.trim());
      if (video.views <= 0) continue;
      updatePlanEntry(item.id, {
        actualViews: video.views,
        actualLikes: video.likes,
        postedAt: item.postedAt > 0 ? item.postedAt : video.createdAt * 1000,
      });
      updated += 1;
    } catch {
      // Ein toter oder privater Link darf den Scan nicht kippen.
    }
  }
  return updated;
}

const asyncHandler =
  (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    handler(req, res).catch(next);
  };

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
    version: APP_VERSION,
    language: settings.language,
    timezone: settings.timezone,
    ai: { configured: aiConfigured(), baseUrl: config.baseUrl, model: config.model },
    server: { host: HOST, localOnly: isLoopbackHost(HOST) },
    scraping: {
      minDelayMs: settings.minDelayMs,
      cookieSet: Boolean(settings.cookie),
      cacheEntries: cacheSize(),
      browserFallback: browserFallbackAvailable(),
    },
    diagnostics: diagnostics(),
  });
});

/* ------------------------------------------------------------------ update */

app.get(
  "/api/update",
  asyncHandler(async (req, res) => {
    const info = await checkForUpdate(req.query.force === "1");
    // Liegt eine hoehere Version bereit, laedt die App sie nebenbei selbst.
    if (info.updateAvailable && info.latest && info.exe) {
      startDownload(info.latest, info.exe, info.exeSize ?? 0);
    }
    res.json({ ...info, download: downloadInfo() });
  }),
);

/**
 * Nur die Windows-App kann sich selbst ersetzen: sie tauscht die Datei beim
 * Beenden und startet auf Wunsch gleich wieder. Im Browser gibt es dafuer
 * keinen Empfaenger, dort bleibt der Download-Knopf.
 */
app.post("/api/update/restart", (_req, res) => {
  const info = downloadInfo();
  const bridge = (globalThis as { __tiktokUpdater?: { restart: (file: string, version: string) => void } })
    .__tiktokUpdater;
  if (!bridge || info.state !== "ready" || !info.file) {
    res.status(409).json({
      error: tr("Der automatische Neustart geht nur in der Windows-App.", "The automatic restart only works in the Windows app."),
      hint: tr(
        "Im Browser die neue Datei herunterladen und die App danach neu starten.",
        "In the browser, download the new file and start the app again afterwards.",
      ),
    });
    return;
  }
  bridge.restart(info.file, info.version ?? "");
  res.json({ ok: true });
});

/**
 * Knopf "Token pruefen": sagt sofort, ob das Token das Release-Repo lesen
 * darf. Ein frisch getipptes Token hat Vorrang vor dem gespeicherten, damit
 * die Pruefung schon vor dem Speichern stimmt.
 */
app.post(
  "/api/update/token",
  asyncHandler(async (req, res) => {
    const typed = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const probe = await probeRepoAccess(typed || effectiveSettings().githubToken);
    res.json(probe);
  }),
);

app.get("/api/version", (_req, res) => {
  res.json({ version: currentVersion() });
});

/* -------------------------------------------------------------------- scan */

app.post(
  "/api/scan",
  asyncHandler(async (req, res) => {      const started = Date.now();
      const rawUrls = Array.isArray(req.body?.videoUrls) ? req.body.videoUrls.map((value: unknown) => String(value)) : [];
      const input = normalizeScanInput(String(req.body?.handle ?? ""), rawUrls);
      const handle = input.handle;
      const urls = input.videoUrls;
      recordScanStart();
      if (!handle) {
        res.status(400).json({
          error: tr("Bitte ein TikTok-Handle angeben (@name oder Profil-URL).", "Please add a TikTok handle (@name or profile URL)."),
        });
        return;
      }
      const timezone = effectiveSettings().timezone;      const profile = await getProfile(handle);
      const warnings: string[] = [];
      for (const entry of input.rejected) {
        warnings.push(tr(`Link ignoriert (${entry.reason}): ${entry.value}`, `Link ignored (${entry.reason}): ${entry.value}`));
      }

    // The newest videos come straight from TikTok, manual links add older ones.
    let automatic: Video[] = [];
    try {
      automatic = await getUserVideos(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Unbekannter Fehler", "Unknown error");
      warnings.push(tr(`Videoliste von TikTok nicht lesbar: ${message}`, `TikTok video list could not be read: ${message}`));
    }

    const scraped = urls.length > 0 ? await scrapeVideos(urls) : { videos: [] as Video[], warnings: [] as string[] };
    warnings.push(...scraped.warnings);

    const seen = new Set<string>();
    const videos: Video[] = [];
    for (const video of [...scraped.videos, ...automatic]) {
      if (!video.id || seen.has(video.id)) continue;
      seen.add(video.id);
      videos.push(video);
    }

    const own = videos.filter((video) => video.author.toLowerCase() === profile.handle.toLowerCase());
    if (videos.length > 0 && own.length === 0) {
      warnings.push(
        tr(
          "Kein Video gehört zu diesem Profil – die Analyse zeigt trotzdem die Performance der verlinkten Videos.",
          "None of the videos belongs to this profile – the analysis still shows how the linked videos performed.",
        ),
      );
    } else if (own.length > 0 && own.length < videos.length) {
      warnings.push(
        tr(
          `${videos.length - own.length} Video(s) anderer Creator wurden nicht in die Metriken gerechnet.`,
          `${videos.length - own.length} video(s) by other creators were left out of the metrics.`,
        ),
      );
    }      const metrics = computeMetrics(profile, own.length > 0 ? own : videos, timezone);

      // Datenlage vor der KI-Auswertung sichtbar machen.
      const quality = assessQuality({ profile, videos: own.length > 0 ? own : videos });
      if (quality.score < 0.7) {
        warnings.push(
          tr(
            `Datenlage duenn (${Math.round(quality.score * 100)} %): ${quality.missing.join(", ")} fehlen.`,
            `Thin data (${Math.round(quality.score * 100)}%): ${quality.missing.join(", ")} missing.`,
          ),
        );
      }

    if (videos.length === 0) {
      warnings.push(
        tr(
          "TikTok hat zu diesem Profil keine Videos geliefert. Private Konten geben keine heraus, sonst später erneut scannen oder Video-Links einfügen.",
          "TikTok returned no videos for this profile. Private accounts never do; otherwise scan again later or add video links.",
        ),
      );
    }

    const result: ScanResult = {
      profile,
      videos,
      metrics,
      warnings,
      durationMs: Date.now() - started,
      scannedAt: Date.now(),
      timezone,
    };
    lastScans.set(profile.handle.toLowerCase(), result);

    // Erledigte Plan-Posts im Hintergrund nachmessen; der Scan wartet nicht darauf.
    void refreshPlanResults().catch(() => undefined);

    if (req.body?.track) {
      trackAccount(profile.handle, profile.nickname, profile.avatar);
      addSnapshot(profile.handle, snapshotFrom(profile, metrics));
    }      res.json(result);
      recordScan(true);
    }),
  );

  /** Most recent scan across all handles, so the UI keeps its context after a reload. */
app.get("/api/last-scan", (_req, res) => {
  const scans = [...lastScans.values()];
  if (scans.length === 0) {
    res.status(404).json({ error: tr("Es liegt noch kein Scan im Speicher.", "No scan is in memory yet.") });
    return;
  }
  res.json(scans.reduce((newest, current) => (current.scannedAt > newest.scannedAt ? current : newest)));
});

app.get("/api/last-scan/:handle", (req, res) => {
  const handle = normalizeHandle(req.params.handle);
  const scan = lastScans.get(handle.toLowerCase());
  if (!scan)
    return res
      .status(404)
      .json({ error: tr("Für diesen Account liegt kein Scan im Speicher.", "No scan for this account is in memory.") });
  res.json(scan);
});

/* ---------------------------------------------------------------------- AI */

app.post(
  "/api/ai",
  asyncHandler(async (req, res) => {
    const mode = String(req.body?.mode ?? "strategy") as AiMode;
    if (!AI_MODES.includes(mode)) {
      res.status(400).json({ error: tr(`Unbekannter KI-Modus: ${mode}`, `Unknown AI mode: ${mode}`) });
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

    // Datenlage vor dem KI-Aufruf pruefen: bei sehr duennen Daten keine
    // Empfehlungen, die wie Messungen aussehen.
    const gate = context ? qualityGate(assessQuality({ profile: context.profile, videos: context.videos })) : null;
    if (gate && gate.blocked.includes(mode)) {
      recordFailure("ai guard");
      res.status(422).json({
        error: gate.warning,
        hint: tr(
          "Starte einen Scan mit Video-Links, damit Views, Likes und Laenge bekannt sind. Danach antwortet die KI wieder mit Hooks und Hashtags.",
          "Run a scan with video links so views, likes and length are known. After that hooks and hashtags work again.",
        ),
      });
      return;
    }
    res.json(await generate(mode, payload, context, gate, planFeedback()));
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
/** Welche Modelle kostenlos sind und wirklich antworten. */
app.post(
  "/api/ai/scan-free",
  asyncHandler(async (req, res) => {
    const baseUrl = req.body?.aiBaseUrl ? String(req.body.aiBaseUrl) : undefined;
    const apiKey = req.body?.aiApiKey ? String(req.body.aiApiKey) : undefined;
    res.json(await scanFreeModels({ baseUrl, apiKey }));
  }),
);

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
      res.status(500).json({ error: tr("Account konnte nicht gespeichert werden.", "The account could not be saved.") });
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
        errors.push({
          handle: account.handle,
          message: error instanceof Error ? error.message : tr("Unbekannter Fehler", "Unknown error"),
        });
      }
    }
    // "Alle messen" prueft auch die erledigten Plan-Posts.
    await refreshPlanResults();
    res.json({ accounts: listAccounts().map(accountView), errors });
  }),
);

app.delete("/api/watchlist/:handle", (req, res) => {
  const removed = untrackAccount(req.params.handle);
  if (!removed)
    return res.status(404).json({ error: tr("Account ist nicht in der Watchlist.", "This account is not on the watchlist.") });
  res.json({ accounts: listAccounts().map(accountView) });
});

/* ------------------------------------------------------------------- video */

app.post(
  "/api/video",
  asyncHandler(async (req, res) => {
    const url = String(req.body?.url ?? "").trim();
    if (!url) {
      res.status(400).json({ error: tr("Bitte eine Video-URL eingeben.", "Please enter a video URL.") });
      return;
    }
    res.json({ video: await getVideoFromInput(url) });
  }),
);

/* -------------------------------------------------------------------- plan */

app.get("/api/plan", (_req, res) => {
  res.json(planPayload());
});

app.post("/api/plan", (req, res) => {
  const body = req.body ?? {};
  const entries = Array.isArray(body.items) ? body.items : [body];
  const cleaned = entries.filter((entry: unknown) => entry && typeof entry === "object") as Record<string, unknown>[];
  addPlan(cleaned);
  res.json(planPayload());
});

app.put("/api/plan/:id", (req, res) => {
  updatePlanEntry(req.params.id, (req.body ?? {}) as Record<string, never>);
  res.json(planPayload());
});

app.delete("/api/plan/:id", (req, res) => {
  deletePlanEntry(req.params.id);
  res.json(planPayload());
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

/**
 * Desktop only: proves the Chromium fallback window works and shows which
 * cookies it collects. The web build answers 501, there is no window there.
 */
app.post(
  "/api/browser-check",
  asyncHandler(async (_req, res) => {
    const probe = await browserProbe("https://www.tiktok.com/@tiktok?lang=de");
    if (!probe) {
      res.status(501).json({
        error: tr(
          "Der Browser-Notausgang gehört zur Desktop-App, im Browser gibt es ihn nicht.",
          "The browser fallback belongs to the desktop app, the browser build has none.",
        ),
        code: "NO_BROWSER",
      });
      return;
    }
    res.json({ ok: probe.htmlLength > 0, ...probe });
  }),
);

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
        res
          .status(503)
          .type("text/plain")
          .send(tr("Frontend nicht gebaut. Bitte `npm run build` ausführen.", "Frontend not built. Please run `npm run build`."));
        return;
      }
      res.sendFile(indexFile);
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: tr(`Route nicht gefunden: ${req.method} ${req.path}`, `Route not found: ${req.method} ${req.path}`) });
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
    res.status(500).json({ error: (error as Error)?.message || tr("Interner Serverfehler", "Internal server error") });
  });

  app.listen(PORT, HOST, () => {
    const url = `http://${isLoopbackHost(HOST) ? "127.0.0.1" : HOST}:${PORT}`;
    console.log(`\n  TikTok Growth Lab runs on ${url}`);
    console.log(`  Local only: ${isLoopbackHost(HOST) ? "yes" : `no (HOST=${HOST})`}`);
    console.log(`  Mode: ${IS_DEV ? "development (Vite HMR)" : "production"}`);
    console.log(`  AI: ${aiConfigured() ? `ready (${aiConfig().model})` : "no key set"}\n`);
  });
}

await start();
