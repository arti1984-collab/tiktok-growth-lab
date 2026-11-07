import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { awayFromNow, formatCompact, formatDate, formatDecimal, formatDuration, formatNumber, formatPercent, weekdayName } from "../format";
import { useT } from "../lang";
import type { AiMode, ScanResult, Status } from "../types";
import { Alert, Badge, EmptyState, ProgressBar, Section, Spinner, Stat } from "../components/ui";
import { VideoCheck } from "../components/VideoCheck";
import { ReportOverlay } from "../components/ReportOverlay";

/** Memoriert den zuletzt gescannten Namen, damit das Feld nach einem Neustart nicht leer ist. */
const RECENT_KEY = "scan.recentHandle";

/** Zieht den Namen aus "@name", einem Profil-Link oder einem Video-Link. */
function nameFromInput(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.match(/@([A-Za-z0-9._]+)/);
  if (at) return at[1].replace(/\.+$/, "");
  return /^[A-Za-z0-9._]+$/.test(trimmed) ? trimmed : "";
}

export function ScanView({
  scan,
  onScan,
  onOpenStudio,
  status,
}: {
  scan: ScanResult | null;
  onScan: (scan: ScanResult) => void;
  onOpenStudio: (mode: AiMode) => void;
  status: Status | null;
}) {
  const t = useT();
  const [handle, setHandle] = useState("");
  const [recent, setRecent] = useState(() => {
    try {
      return window.localStorage.getItem(RECENT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [tracked, setTracked] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [track, setTrack] = useState(true);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ message: string; hint: string } | null>(null);

  const videoUrls = useMemo(
    () =>
      videoInput
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [videoInput],
  );

  function remember(value: string) {
    const name = nameFromInput(value);
    if (!name) return;
    setRecent(name);
    try {
      window.localStorage.setItem(RECENT_KEY, name);
    } catch {
      // Without storage the name still stays in this window.
    }
  }

  // Nach einem Neustart hält der Server den letzten Scan noch vor, also ist der Name sofort da.
  useEffect(() => {
    if (scan?.profile.handle) remember(scan.profile.handle);
  }, [scan?.profile.handle]);

  // Wächst mit jedem Scan, damit ein neu aufgenommenes Konto sofort als Knopf auftaucht.
  useEffect(() => {
    let active = true;
    api
      .watchlist()
      .then((data) => {
        if (active) setTracked(data.accounts.map((account) => account.handle));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [scan?.scannedAt]);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 400);
    return () => clearInterval(timer);
  }, [loading]);

  const estimatedSeconds = Math.round(((videoUrls.length + 2) * (status?.scraping.minDelayMs ?? 1200)) / 1000) + 2;

  // Der zuletzt gescannte Name zuerst, dann die getrackten Konten; der Name im Feld fällt raus.
  const quickPicks = useMemo(() => {
    const current = nameFromInput(handle).toLowerCase();
    const seen = new Set<string>();
    return [recent, ...tracked].filter((name) => {
      const key = name.toLowerCase();
      if (!key || key === current || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recent, tracked, handle]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    remember(handle);
    setLoading(true);
    setError(null);
    setElapsed(0);
    try {
      const result = await api.scan({ handle, videoUrls, track });
      onScan(result);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError({ message: apiError.message ?? t("Scan fehlgeschlagen.", "Scan failed."), hint: apiError.hint ?? "" });
    } finally {
      setLoading(false);
    }
  }

  const metrics = scan?.metrics;
  const profile = scan?.profile;

  return (
    <div className="stack">
      <Section
        title={t("Account scannen", "Scan an account")}
        subtitle={t(
          "Trag den Link oder den Namen deines Profils ein. Danach steht unter dem Profil, wo es hakt und was du besser machst.",
          "Enter your profile link or name. Below the profile you then see where it breaks down and what to do better.",
        )}
      >
        <form className="scan-form" onSubmit={submit}>
          <div className="grid-two">
            <label className="field">
              <span>{t("Link oder Name des Profils", "Profile link or name")}</span>
              <input
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder={t("@deinaccount oder https://www.tiktok.com/@deinaccount", "@youraccount or https://www.tiktok.com/@youraccount")}
                spellCheck={false}
                required
              />
              {quickPicks.length > 0 && (
                <div className="row gap-sm wrap">
                  <span className="muted small">{t("Schnell wählen:", "Quick pick:")}</span>
                  {quickPicks.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="chip-btn"
                      onClick={() => setHandle(`@${name}`)}
                      title={t(`@${name} einsetzen`, `Use @${name}`)}
                    >
                      {name === recent ? `${t("Zuletzt", "Last")}: @${name}` : `@${name}`}
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label className="field">
              <span>{t("Video-Links (optional, je Zeile einer)", "Video links (optional, one per line)")}</span>
              <textarea
                value={videoInput}
                onChange={(event) => setVideoInput(event.target.value)}
                placeholder={"https://www.tiktok.com/@deinaccount/video/123…\nhttps://vm.tiktok.com/ZMabc123/"}
                rows={5}
                spellCheck={false}
              />
              <small className="muted">
                {t(
                  `${videoUrls.length} Link(s) zusätzlich. Die neuesten 15 Videos liest der Scan selbst von TikTok, hier nur ältere Videos einfügen (in TikTok: Video → Teilen → Link kopieren).`,
                  `${videoUrls.length} extra link(s). The scan reads the newest 15 videos from TikTok itself, so only add older videos here (in TikTok: video → share → copy link).`,
                )}
              </small>
            </label>
          </div>

          <div className="row space-between wrap gap">
            <label className="checkbox">
              <input type="checkbox" checked={track} onChange={(event) => setTrack(event.target.checked)} />
              <span>{t("In Wachstums-Tracking aufnehmen", "Add to growth tracking")}</span>
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading || !handle.trim()}>
              {loading ? <Spinner label={`${t("Scanne…", "Scanning…")} ${elapsed}s`} /> : t("Schwächen prüfen", "Check weaknesses")}
            </button>
          </div>

          {loading && (
            <p className="muted small">
              {t(
                `TikTok erlaubt nur eine Anfrage alle ${formatDecimal(
                  (status?.scraping.minDelayMs ?? 1200) / 1000,
                  1,
                )} s – geschätzte Dauer: ca. ${estimatedSeconds} s. Bitte offen lassen.`,
                `TikTok allows one request every ${formatDecimal(
                  (status?.scraping.minDelayMs ?? 1200) / 1000,
                  1,
                )} s, so this takes about ${estimatedSeconds} s. Please leave it open.`,
              )}
            </p>
          )}
        </form>

        {error && (
          <Alert kind="error">
            <strong>{error.message}</strong>
            {error.hint && <div className="small">{error.hint}</div>}
          </Alert>
        )}
      </Section>

      <VideoCheck scan={scan} />
      {reportOpen && scan && <ReportOverlay scan={scan} onClose={() => setReportOpen(false)} />}

      {!scan && !loading && (
        <EmptyState
          title={t("Noch keine Analyse", "No analysis yet")}
          text={t(
            "Ein Name genügt: Der Scan liest Profil und die neuesten 15 Videos mit Views, Likes, Kommentaren, Shares, Saves und Uhrzeiten direkt von tiktok.com. Für ältere Videos kannst du zusätzlich Links einfügen.",
            "A name is enough: the scan reads the profile and the newest 15 videos with views, likes, comments, shares, saves and times straight from tiktok.com. For older videos you can add links as well.",
          )}
        />
      )}

      {scan && profile && metrics && (
        <>
          <Section className="profile-card">
            <div className="profile-main">
              {profile.avatar ? <img className="avatar lg" src={profile.avatar} alt="" referrerPolicy="no-referrer" /> : <div className="avatar lg" />}
              <div className="profile-text">
                <div className="row gap-sm center wrap">
                  <h2>{profile.nickname}</h2>
                  {profile.verified && <Badge tone="info">{t("verifiziert", "verified")}</Badge>}
                  {profile.privateAccount && <Badge tone="warn">{t("privat", "private")}</Badge>}
                  {profile.region && <Badge>{profile.region}</Badge>}
                </div>
                <a className="muted" href={profile.url} target="_blank" rel="noreferrer">
                  @{profile.handle}
                </a>
                {profile.bio && <p className="bio">{profile.bio}</p>}
                <div className="row gap-sm wrap small muted">
                  <span>
                    {formatCompact(profile.followers)} {t("Follower", "followers")}
                  </span>
                  <span>·</span>
                  <span>
                    {formatNumber(profile.videos)} {t("Videos", "videos")}
                  </span>
                  <span>·</span>
                  <span>
                    {formatCompact(profile.hearts)} {t("Likes gesamt", "likes in total")}
                  </span>
                  <span>·</span>
                  <span>
                    {t("gescannt in", "scanned in")} {formatDecimal(scan.durationMs / 1000, 1)} s
                  </span>
                </div>
              </div>
              <div className="score-box">
                <button className="btn btn-sm" onClick={() => setReportOpen(true)}>
                  {t("Wochenbericht", "Weekly report")}
                </button>
                <span className="score-value">{metrics.score ?? "–"}</span>
                <span className="score-label">{t("Growth-Score von 100", "growth score out of 100")}</span>
                <div className="score-meter" aria-hidden>
                  <span style={{ width: `${Math.max(0, Math.min(100, metrics.score ?? 0))}%` }} />
                </div>
              </div>
            </div>
          </Section>

          <Section
            title={t("Wo es hakt", "Where it breaks down")}
            subtitle={t("Aus deinen Zahlen, ohne KI. Dringendes zuerst.", "From your numbers, no AI involved. Most urgent first.")}
          >
            {metrics.weaknesses.length === 0 ? (
              <Alert kind="success">
                {t(
                  "In diesen Zahlen steckt keine klare Schwäche. Halte den Rhythmus und teste weiter neue Hooks.",
                  "These numbers show no clear weakness. Keep the cadence and keep testing new hooks.",
                )}
              </Alert>
            ) : (
              <ul className="weakness-list">
                {metrics.weaknesses.map((weakness) => (
                  <li className={`weakness weakness-${weakness.severity}`} key={weakness.key}>
                    <div className="weakness-head">
                      <strong>{weakness.title}</strong>
                      <Badge tone={weakness.severity === "high" ? "warn" : "info"}>
                        {weakness.severity === "high" ? t("dringend", "urgent") : t("ausbaufähig", "worth fixing")}
                      </Badge>
                    </div>
                    <p>{weakness.problem}</p>
                    <p className="weakness-action">
                      <strong>{t("Besser machen", "Do this instead")}:</strong> {weakness.action}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {scan.warnings.length > 0 && (
            <Alert kind="warn">
              <strong>{t("Hinweise zum Scan", "Notes on the scan")}</strong>
              <ul className="tight">
                {scan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}

          {metrics.hasData ? (
            <>
              <div className="stat-grid">
                <Stat
                  label={t("Engagement-Rate", "Engagement rate")}
                  value={formatPercent(metrics.engagementRate)}
                  hint={t("Benchmark 4,5 %", "benchmark 4.5%")}
                  tone={(metrics.engagementRate ?? 0) >= 4.5 ? "good" : "warn"}
                />
                <Stat label={t("Ø Views", "Ø views")} value={formatCompact(metrics.avgViews)} hint={`${t("Median", "median")} ${formatCompact(metrics.medianViews)}`} />
                <Stat
                  label={t("Views / Follower", "Views / follower")}
                  value={formatDecimal(metrics.viewsPerFollower, 2)}
                  hint={
                    (metrics.viewsPerFollower ?? 0) >= 1
                      ? t("For-You-Reichweite aktiv", "reaching the For You feed")
                      : t("viel Follower-Reichweite", "mostly follower reach")
                  }
                  tone={(metrics.viewsPerFollower ?? 0) >= 1 ? "good" : "warn"}
                />
                <Stat
                  label={t("Posts / Woche", "Posts / week")}
                  value={formatDecimal(metrics.postsPerWeek, 1)}
                  hint={`Ø ${formatDuration(metrics.avgDuration ?? 0)} ${t("pro Video", "per video")}`}
                />
                <Stat label={t("Saves", "Saves")} value={formatPercent(metrics.saveRate)} hint={t("stärkstes Reichweiten-Signal", "strongest reach signal")} tone="accent" />
                <Stat
                  label={t("Shares", "Shares")}
                  value={formatPercent(metrics.shareRate)}
                  hint={t(`${metrics.outliers.count} Ausreißer nach oben`, `${metrics.outliers.count} outliers above the median`)}
                />
              </div>

              <Section
                title={t("Was die Daten sagen", "What the data says")}
                subtitle={t("Automatisch berechnet aus den gescannten Videos", "Calculated automatically from the scanned videos")}
              >
                <div className="insight-list">
                  {metrics.insights.map((insight) => (
                    <div className={`insight insight-${insight.kind}`} key={insight.title}>
                      <span className="dot" />
                      <div>
                        <strong>{insight.title}</strong>
                        <p>{insight.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="grid-two">
                <Section title={t("Beste Zeitfenster", "Best time windows")} subtitle={`${t("Zeitzone", "Timezone")} ${scan.timezone}`}>
                  {metrics.bestSlots.length === 0 ? (
                    <p className="muted small">{t("Keine Uhrzeiten berechenbar.", "No times can be calculated.")}</p>
                  ) : (
                    <ul className="slot-list">
                      {metrics.bestSlots.map((slot) => (
                        <li key={`${slot.weekday}-${slot.hour}`}>
                          <span className="slot-time">
                            {weekdayName(slot.weekday - 1)} · {String(slot.hour).padStart(2, "0")}:00
                          </span>
                          <span className="slot-bar">
                            <ProgressBar value={slot.avgViews} max={metrics.bestSlots[0].avgViews} />
                          </span>
                          <span className="slot-value">{formatCompact(slot.avgViews)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title={t("Videolänge", "Video length")} subtitle={t("Ø Views je Längen-Fenster", "Ø views per length window")}>
                  <ul className="slot-list">
                    {metrics.durationBuckets.map((bucket) => (
                      <li key={bucket.label}>
                        <span className="slot-time">{bucket.label}</span>
                        <span className="slot-bar">
                          <ProgressBar value={bucket.avgViews} max={Math.max(...metrics.durationBuckets.map((entry) => entry.avgViews), 1)} />
                        </span>
                        <span className="slot-value">{bucket.posts === 0 ? "–" : formatCompact(bucket.avgViews)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="muted small">
                    {t("Durchschnittliche Videolänge", "Average video length")}: {formatDuration(metrics.avgDuration)}
                  </p>
                </Section>
              </div>

              {metrics.hashtags.length > 0 && (
                <Section title={t("Hashtags im Einsatz", "Hashtags in use")} subtitle={t("Nutzung und durchschnittliche Views", "Usage and average views")}>
                  <div className="chip-row">
                    {metrics.hashtags.map((tag) => (
                      <span className="chip chip-data" key={tag.tag}>
                        #{tag.tag}
                        <em>
                          {tag.posts}× · {formatCompact(tag.avgViews)}
                        </em>
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              <Section
                title={t("Top-Videos", "Top videos")}
                subtitle={t(
                  `${scan.videos.length} Videos gescannt · bewertet gegen Median ${formatCompact(metrics.medianViews)} Views`,
                  `${scan.videos.length} videos scanned · compared to the median of ${formatCompact(metrics.medianViews)} views`,
                )}
                actions={
                  <button className="btn btn-ghost" onClick={() => onOpenStudio("audit")}>
                    {t("KI-Audit starten", "Run AI audit")}
                  </button>
                }
              >
                <div className="video-list">
                  {metrics.topVideos.map((video) => (
                    <a className="video-row" href={video.url} target="_blank" rel="noreferrer" key={video.id}>
                      {video.thumbnail ? <img src={video.thumbnail} alt="" referrerPolicy="no-referrer" /> : <div className="thumb" />}
                      <div className="video-text">
                        <span className="video-desc">{video.desc || t("(ohne Caption)", "(no caption)")}</span>
                        <span className="muted small">
                          {formatDate(video.createdAt)} · {awayFromNow(video.createdAt)} · {formatDuration(video.durationSec)}
                        </span>
                      </div>
                      <div className="video-numbers">
                        <strong>{formatCompact(video.views)}</strong>
                        <span className="muted small">{t("Views", "views")}</span>
                      </div>
                      <div className="video-numbers">
                        <strong>{formatPercent(video.engagementRate)}</strong>
                        <span className="muted small">{t("Engagement", "engagement")}</span>
                      </div>
                      <div className="video-numbers">
                        <strong className={video.multipleOfMedian >= 2 ? "text-good" : ""}>{formatDecimal(video.multipleOfMedian, 1)}×</strong>
                        <span className="muted small">{t("vs. Median", "vs. median")}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </Section>

              <Section title={t("Alle gescannten Videos", "All scanned videos")} subtitle={t("Rohdaten direkt aus TikTok", "Raw data straight from TikTok")} className="collapsible">
                <details>
                  <summary>
                    {t("Tabellenansicht", "Table view")} ({scan.videos.length})
                  </summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Datum", "Date")}</th>
                          <th>Caption</th>
                          <th className="right">Views</th>
                          <th className="right">Likes</th>
                          <th className="right">{t("Kommentare", "Comments")}</th>
                          <th className="right">Shares</th>
                          <th className="right">Saves</th>
                          <th className="right">{t("Länge", "Length")}</th>
                          <th>Sound</th>
                          <th>{t("Video-URL", "Video URL")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...scan.videos]
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .map((video) => (
                            <tr key={video.id}>
                              <td className="nowrap">{formatDate(video.createdAt)}</td>
                              <td>
                                <a href={video.url} target="_blank" rel="noreferrer">
                                  {(video.desc || t("(ohne Caption)", "(no caption)")).slice(0, 70)}
                                </a>
                              </td>
                              <td className="right">{formatNumber(video.views)}</td>
                              <td className="right">{formatNumber(video.likes)}</td>
                              <td className="right">{formatNumber(video.comments)}</td>
                              <td className="right">{formatNumber(video.shares)}</td>
                              <td className="right">{formatNumber(video.saves)}</td>
                              <td className="right">{formatDuration(video.durationSec)}</td>
                              <td className="nowrap">
                                {video.originalSound ? t("Originalton", "original sound") : video.music || "–"}
                              </td>
                              <td className="nowrap small">
                                <a href={video.url} target="_blank" rel="noreferrer">
                                  {video.url.replace("https://www.tiktok.com/", "")}
                                </a>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Section>

              <Section title={t("KI-Coach", "AI coach")} subtitle={t("Arbeitet mit diesen echten Zahlen", "Works with these real numbers")}>
                <div className="row gap wrap">
                  <button className="btn btn-primary" onClick={() => onOpenStudio("strategy")}>
                    {t("30-Tage-Strategie", "30-day strategy")}
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("ideas")}>
                    {t("Video-Ideen", "Video ideas")}
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("calendar")}>
                    {t("7-Tage-Plan", "7-day plan")}
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("audit")}>
                    {t("Profil-Audit", "Profile audit")}
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("hooks")}>
                    Hooks
                  </button>
                </div>
                {status && !status.ai.configured && (
                  <Alert kind="info">
                    {t(
                      "Für die KI-Funktionen fehlt noch ein API-Key. Alle Messwerte oben kommen ohne KI direkt aus den TikTok-Daten.",
                      "The AI features still need an API key. Every metric above comes straight from the TikTok data, no AI involved.",
                    )}
                  </Alert>
                )}
              </Section>
            </>
          ) : (
            <Section title={t("Keine Videos geliefert", "No videos returned")} subtitle={t("Profil-Stats oben sind live von TikTok", "The profile stats above are live from TikTok")}>
              <p className="muted">
                {t(
                  "TikTok hat für dieses Profil keine Videoliste herausgegeben. Bei einem privaten Konto bleibt es beim Profil. Sonst starte den Scan später erneut oder füge einzelne Video-Links oben ein.",
                  "TikTok returned no video list for this profile. A private account stays at the profile. Otherwise run the scan again later or paste single video links above.",
                )}
              </p>
              <div className="row gap wrap">
                <button className="btn btn-primary" onClick={() => onOpenStudio("strategy")}>
                  {t("Trotzdem Strategie erstellen", "Build a strategy anyway")}
                </button>
                <button className="btn" onClick={() => onOpenStudio("ideas")}>
                  {t("Video-Ideen generieren", "Generate video ideas")}
                </button>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
