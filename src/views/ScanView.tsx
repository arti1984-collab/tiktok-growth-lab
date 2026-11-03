import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { awayFromNow, formatCompact, formatDate, formatDecimal, formatDuration, formatNumber, formatPercent, WEEKDAYS } from "../format";
import type { AiMode, ScanResult, Status } from "../types";
import { Alert, Badge, EmptyState, ProgressBar, Section, Spinner, Stat } from "../components/ui";

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
  const [handle, setHandle] = useState("");
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

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 400);
    return () => clearInterval(timer);
  }, [loading]);

  const estimatedSeconds = Math.round(((videoUrls.length + 2) * (status?.scraping.minDelayMs ?? 1200)) / 1000) + 2;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setElapsed(0);
    try {
      const result = await api.scan({ handle, videoUrls, track });
      onScan(result);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError({ message: apiError.message ?? "Scan fehlgeschlagen.", hint: apiError.hint ?? "" });
    } finally {
      setLoading(false);
    }
  }

  const metrics = scan?.metrics;
  const profile = scan?.profile;

  return (
    <div className="stack">
      <Section
        title="Account scannen"
        subtitle="Liest Profil und Post-Performance direkt von tiktok.com – ohne Login."
      >
        <form className="scan-form" onSubmit={submit}>
          <div className="grid-two">
            <label className="field">
              <span>TikTok-Name oder Profil-URL</span>
              <input
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="@deinaccount oder https://www.tiktok.com/@deinaccount"
                spellCheck={false}
                required
              />
            </label>
            <label className="field">
              <span>Video-Links (optional, je Zeile einer)</span>
              <textarea
                value={videoInput}
                onChange={(event) => setVideoInput(event.target.value)}
                placeholder={"https://www.tiktok.com/@deinaccount/video/123…\nhttps://vm.tiktok.com/ZMabc123/"}
                rows={5}
                spellCheck={false}
              />
              <small className="muted">
                {videoUrls.length} Link(s) zusätzlich. Die neuesten 15 Videos liest der Scan selbst von TikTok, hier nur
                ältere Videos einfügen (in TikTok: Video → Teilen → Link kopieren).
              </small>
            </label>
          </div>

          <div className="row space-between wrap gap">
            <label className="checkbox">
              <input type="checkbox" checked={track} onChange={(event) => setTrack(event.target.checked)} />
              <span>In Wachstums-Tracking aufnehmen</span>
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading || !handle.trim()}>
              {loading ? <Spinner label={`Scanne… ${elapsed}s`} /> : "Jetzt analysieren"}
            </button>
          </div>

          {loading && (
            <p className="muted small">
              TikTok erlaubt nur eine Anfrage alle {formatDecimal(((status?.scraping.minDelayMs ?? 1200) / 1000), 1)} s –
              geschätzte Dauer: ca. {estimatedSeconds} s. Bitte offen lassen.
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

      {!scan && !loading && (
        <EmptyState
          title="Noch keine Analyse"
          text="Ein Name genügt: Der Scan liest Profil und die neuesten 15 Videos mit Views, Likes, Kommentaren, Shares, Saves und Uhrzeiten direkt von tiktok.com. Für ältere Videos kannst du zusätzlich Links einfügen."
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
                  {profile.verified && <Badge tone="info">verifiziert</Badge>}
                  {profile.privateAccount && <Badge tone="warn">privat</Badge>}
                  {profile.region && <Badge>{profile.region}</Badge>}
                </div>
                <a className="muted" href={profile.url} target="_blank" rel="noreferrer">
                  @{profile.handle}
                </a>
                {profile.bio && <p className="bio">{profile.bio}</p>}
                <div className="row gap-sm wrap small muted">
                  <span>{formatCompact(profile.followers)} Follower</span>
                  <span>·</span>
                  <span>{formatNumber(profile.videos)} Videos</span>
                  <span>·</span>
                  <span>{formatCompact(profile.hearts)} Likes gesamt</span>
                  <span>·</span>
                  <span>gescannt in {formatDecimal(scan.durationMs / 1000, 1)} s</span>
                </div>
              </div>
              <div className="score-box">
                <div className="score-ring" style={{ ["--value" as string]: `${metrics.score ?? 0}` }}>
                  <span>{metrics.score ?? "–"}</span>
                </div>
                <small className="muted">Growth-Score</small>
              </div>
            </div>
          </Section>

          {scan.warnings.length > 0 && (
            <Alert kind="warn">
              <strong>Hinweise zum Scan</strong>
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
                <Stat label="Engagement-Rate" value={formatPercent(metrics.engagementRate)} hint="Benchmark 4,5 %" tone={(metrics.engagementRate ?? 0) >= 4.5 ? "good" : "warn"} />
                <Stat label="Ø Views" value={formatCompact(metrics.avgViews)} hint={`Median ${formatCompact(metrics.medianViews)}`} />
                <Stat
                  label="Views / Follower"
                  value={formatDecimal(metrics.viewsPerFollower, 2)}
                  hint={(metrics.viewsPerFollower ?? 0) >= 1 ? "For-You-Reichweite aktiv" : "viel Follower-Reichweite"}
                  tone={(metrics.viewsPerFollower ?? 0) >= 1 ? "good" : "warn"}
                />
                <Stat label="Posts / Woche" value={formatDecimal(metrics.postsPerWeek, 1)} hint={`Ø ${formatDuration(metrics.avgDuration ?? 0)} pro Video`} />
                <Stat label="Saves" value={formatPercent(metrics.saveRate)} hint="stärkstes Reichweiten-Signal" tone="accent" />
                <Stat label="Shares" value={formatPercent(metrics.shareRate)} hint={`${metrics.outliers.count} Ausreißer nach oben`} />
              </div>

              <Section title="Was die Daten sagen" subtitle="Automatisch berechnet aus den gescrapten Videos">
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
                <Section title="Beste Zeitfenster" subtitle={`Zeitzone ${scan.timezone}`}>
                  {metrics.bestSlots.length === 0 ? (
                    <p className="muted small">Keine Uhrzeiten berechenbar.</p>
                  ) : (
                    <ul className="slot-list">
                      {metrics.bestSlots.map((slot) => (
                        <li key={`${slot.weekday}-${slot.hour}`}>
                          <span className="slot-time">
                            {WEEKDAYS[slot.weekday - 1]} · {String(slot.hour).padStart(2, "0")}:00
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

                <Section title="Videolänge" subtitle="Ø Views je Längen-Fenster">
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
                  <p className="muted small">Durchschnittliche Videolänge: {formatDuration(metrics.avgDuration)}</p>
                </Section>
              </div>

              {metrics.hashtags.length > 0 && (
                <Section title="Hashtags im Einsatz" subtitle="Nutzung und durchschnittliche Views">
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
                title="Top-Videos"
                subtitle={`${scan.videos.length} Videos gescrapt · bewertet gegen Median ${formatCompact(metrics.medianViews)} Views`}
                actions={<button className="btn btn-ghost" onClick={() => onOpenStudio("audit")}>KI-Audit starten</button>}
              >
                <div className="video-list">
                  {metrics.topVideos.map((video) => (
                    <a className="video-row" href={video.url} target="_blank" rel="noreferrer" key={video.id}>
                      {video.thumbnail ? <img src={video.thumbnail} alt="" referrerPolicy="no-referrer" /> : <div className="thumb" />}
                      <div className="video-text">
                        <span className="video-desc">{video.desc || "(ohne Caption)"}</span>
                        <span className="muted small">
                          {formatDate(video.createdAt)} · {awayFromNow(video.createdAt)} · {formatDuration(video.durationSec)}
                        </span>
                      </div>
                      <div className="video-numbers">
                        <strong>{formatCompact(video.views)}</strong>
                        <span className="muted small">Views</span>
                      </div>
                      <div className="video-numbers">
                        <strong>{formatPercent(video.engagementRate)}</strong>
                        <span className="muted small">Engagement</span>
                      </div>
                      <div className="video-numbers">
                        <strong className={video.multipleOfMedian >= 2 ? "text-good" : ""}>{formatDecimal(video.multipleOfMedian, 1)}×</strong>
                        <span className="muted small">vs. Median</span>
                      </div>
                    </a>
                  ))}
                </div>
              </Section>

              <Section title="Alle gescrapten Videos" subtitle="Rohdaten direkt aus TikTok" className="collapsible">
                <details>
                  <summary>Tabellenansicht ({scan.videos.length})</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Caption</th>
                          <th className="right">Views</th>
                          <th className="right">Likes</th>
                          <th className="right">Kommentare</th>
                          <th className="right">Shares</th>
                          <th className="right">Saves</th>
                          <th className="right">Länge</th>
                          <th>Sound</th>
                          <th>Video-URL</th>
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
                                  {(video.desc || "(ohne Caption)").slice(0, 70)}
                                </a>
                              </td>
                              <td className="right">{formatNumber(video.views)}</td>
                              <td className="right">{formatNumber(video.likes)}</td>
                              <td className="right">{formatNumber(video.comments)}</td>
                              <td className="right">{formatNumber(video.shares)}</td>
                              <td className="right">{formatNumber(video.saves)}</td>
                              <td className="right">{formatDuration(video.durationSec)}</td>
                              <td className="nowrap">{video.originalSound ? "Originalton" : video.music || "–"}</td>
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

              <Section title="KI-Coach" subtitle="Arbeitet mit diesen echten Zahlen">
                <div className="row gap wrap">
                  <button className="btn btn-primary" onClick={() => onOpenStudio("strategy")}>
                    30-Tage-Strategie
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("ideas")}>
                    Video-Ideen
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("calendar")}>
                    7-Tage-Plan
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("audit")}>
                    Profil-Audit
                  </button>
                  <button className="btn" onClick={() => onOpenStudio("hooks")}>
                    Hooks
                  </button>
                </div>
                {status && !status.ai.configured && (
                  <Alert kind="info">
                    Für die KI-Funktionen fehlt noch ein API-Key. Alle Messwerte oben kommen ohne KI direkt aus den TikTok-Daten.
                  </Alert>
                )}
              </Section>
            </>
          ) : (
            <Section title="Keine Videos geliefert" subtitle="Profil-Stats oben sind live von TikTok">
              <p className="muted">
                TikTok hat für dieses Profil keine Videoliste herausgegeben. Bei einem privaten Konto bleibt es beim Profil.
                Sonst starte den Scan später erneut oder füge einzelne Video-Links oben ein.
              </p>
              <div className="row gap wrap">
                <button className="btn btn-primary" onClick={() => onOpenStudio("strategy")}>
                  Trotzdem Strategie erstellen
                </button>
                <button className="btn" onClick={() => onOpenStudio("ideas")}>
                  Video-Ideen generieren
                </button>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
