import { useCallback } from "react";
import { formatCompact, formatDate, formatNumber, formatPercent, formatSigned } from "../format";
import { useT } from "../lang";
import type { ScanResult } from "../types";

/**
 * Wochenbericht als Overlay: die Zahlen eines Scans zum Nachlesen und zum
 * Weitergeben per Zwischenablage.
 */
export function ReportOverlay({ scan, onClose }: { scan: ScanResult; onClose: () => void }) {
  const t = useT();
  const metrics = scan.metrics;
  const top = metrics.topVideos.slice(0, 3);

  const buildText = useCallback(() => {
    const lines = [
      `TikTok Growth Lab · @${scan.profile.handle}`,
      `${t("Stand", "As of")}: ${formatDate(scan.scannedAt / 1000)}`,
      "",
      `${t("Follower", "Followers")}: ${formatNumber(scan.profile.followers)}`,
      `${t("Videos im Sample", "Videos in the sample")}: ${metrics.sampleSize}`,
      `${t("Score", "Score")}: ${metrics.score ?? "–"}/100`,
      `${t("Engagement", "Engagement")}: ${formatPercent(metrics.engagementRate)}`,
      `${t("Views im Schnitt", "Average views")}: ${formatNumber(metrics.avgViews)}`,
      `${t("Median", "Median")}: ${formatNumber(metrics.medianViews)}`,
      `${t("Posts pro Woche", "Posts per week")}: ${metrics.postsPerWeek != null ? metrics.postsPerWeek.toFixed(1) : "–"}`,
      "",
      t("Beste Videos", "Best videos"),
      ...top.map((video, index) => `${index + 1}. ${formatNumber(video.views)} Views · ${video.desc.slice(0, 70) || t("ohne Text", "no text")}`),
      "",
      t("Was die Daten sagen", "What the data says"),
      ...metrics.insights.map((insight) => `- ${insight.title}: ${insight.text}`),
    ];
    return lines.join("\n");
  }, [scan, metrics, top, t]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildText());
    } catch {
      // Clipboard may be blocked; printing still works.
    }
  }

  return (
    <div className="report-overlay" role="dialog" aria-modal="true">
      <div className="report-sheet">
        <header className="report-head">
          <div>
            <h2>{t("Wochenbericht", "Weekly report")}</h2>
            <p className="muted small">
              @{scan.profile.handle} · {formatDate(scan.scannedAt / 1000)}
            </p>
          </div>
          <div className="row gap-sm">
            <button className="btn btn-sm btn-primary" onClick={() => void copy()}>
              {t("Text kopieren", "Copy text")}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              {t("Schließen", "Close")}
            </button>
          </div>
        </header>

        <div className="report-stats">
          <div>
            <span>{t("Follower", "Followers")}</span>
            <strong>{formatNumber(scan.profile.followers)}</strong>
          </div>
          <div>
            <span>{t("Score", "Score")}</span>
            <strong>{metrics.score ?? "–"}/100</strong>
          </div>
          <div>
            <span>{t("Engagement", "Engagement")}</span>
            <strong>{formatPercent(metrics.engagementRate)}</strong>
          </div>
          <div>
            <span>{t("Views je Video", "Views per video")}</span>
            <strong>{formatCompact(metrics.avgViews)}</strong>
          </div>
          <div>
            <span>{t("Posts pro Woche", "Posts per week")}</span>
            <strong>{metrics.postsPerWeek != null ? metrics.postsPerWeek.toFixed(1) : "–"}</strong>
          </div>
          <div>
            <span>{t("Videos im Sample", "Videos in the sample")}</span>
            <strong>{metrics.sampleSize}</strong>
          </div>
        </div>

        {top.length > 0 && (
          <>
            <h3>{t("Beste Videos", "Best videos")}</h3>
            <ol className="report-list">
              {top.map((video) => (
                <li key={video.id}>
                  <strong>{formatNumber(video.views)}</strong> {t("Views", "views")} ·{" "}
                  <span className="muted">
                    {formatSigned(Math.round((video.multipleOfMedian - 1) * 100))} % {t("gegenüber Median", "against median")}
                  </span>
                  <div>{video.desc.slice(0, 120) || t("ohne Beschreibung", "no caption")}</div>
                </li>
              ))}
            </ol>
          </>
        )}

        <h3>{t("Was die Daten sagen", "What the data says")}</h3>
        <ul className="report-list">
          {metrics.insights.map((insight, index) => (
            <li key={`${insight.title}-${index}`}>
              <strong>{insight.title}:</strong> {insight.text}
            </li>
          ))}
        </ul>

        <p className="muted small">
          {t(
            "Erstellt mit TikTok Growth Lab. Zahlen aus dem öffentlichen TikTok-Profil, keine Schätzungen.",
            "Made with TikTok Growth Lab. Numbers from the public TikTok profile, no estimates.",
          )}
        </p>
      </div>
    </div>
  );
}
