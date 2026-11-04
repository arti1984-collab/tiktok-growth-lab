import { useState } from "react";
import { ApiError, api } from "../api";
import { formatCompact, formatDate, formatDecimal, formatDuration, formatNumber, formatPercent, weekdayName } from "../format";
import { useT } from "../lang";
import type { ScanResult, Video } from "../types";
import { Alert, Badge, Section, Spinner } from "./ui";

/**
 * Einzelnes Video gegen den eigenen Durchschnitt prüfen: Views, Engagement,
 * Länge, Hashtags und der Zeitpunkt im Vergleich zu den besten Slots.
 */

const bucketTop = (label: string): number | null => {
  const numbers = label.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  return Number(numbers[numbers.length - 1]);
};

export function VideoCheck({ scan }: { scan: ScanResult | null }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.video(url.trim());
      setVideo(data.video);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(`${apiError.message} ${apiError.hint}`.trim());
      setVideo(null);
    } finally {
      setBusy(false);
    }
  }

  const metrics = scan?.metrics ?? null;
  const engagement =
    video && video.views > 0 ? ((video.likes + video.comments + video.shares + video.saves) / video.views) * 100 : null;
  const multiple = video && metrics && metrics.medianViews > 0 ? video.views / metrics.medianViews : null;
  const bucket =
    video && metrics
      ? metrics.durationBuckets.find((entry) => {
          const top = bucketTop(entry.label);
          return top !== null && video.durationSec <= top;
        })
      : null;
  const slot = video ? new Date(video.createdAt * 1000) : null;
  const weekday = slot ? weekdayName((slot.getDay() + 6) % 7) : "";
  const bestHour = metrics?.bestSlots.find((entry) => slot && entry.weekday === ((slot.getDay() + 6) % 7) + 1) ?? null;

  return (
    <Section
      title={t("Video-Check", "Video check")}
      subtitle={t(
        "Eine Video-URL einwerfen: die App stellt sie neben deinen Median, dein Engagement und deine besten Zeiten.",
        "Paste a video URL and the app compares it with your median, your engagement and your best times.",
      )}
    >
      <form className="row gap wrap" onSubmit={check}>
        <input
          className="inline-input"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("https://www.tiktok.com/@name/video/123…", "https://www.tiktok.com/@name/video/123…")}
          spellCheck={false}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? <Spinner label={t("Lade Video…", "Loading video…")} /> : t("Prüfen", "Check")}
        </button>
      </form>

      {error && <Alert kind="error">{error}</Alert>}

      {video && (
        <div className="stack-tight">
          <div className="row gap-sm center wrap">
            <Badge tone={(multiple ?? 0) >= 1 ? "good" : "warn"}>
              {multiple ? t(`${formatDecimal(multiple, 1)}× Median`, `${formatDecimal(multiple, 1)}x median`) : t("ohne Vergleich", "no comparison")}
            </Badge>
            <strong>@{video.author}</strong>
            <span className="muted small">{formatDate(video.createdAt)}</span>
          </div>
          <p className="desc">{video.desc || t("Ohne Beschreibung", "No caption")}</p>

          <ul className="kv">
            <li>
              <span>{t("Views", "Views")}</span>
              <strong>{formatNumber(video.views)}</strong>
            </li>
            <li>
              <span>{t("Likes", "Likes")}</span>
              <strong>{formatNumber(video.likes)}</strong>
            </li>
            <li>
              <span>{t("Kommentare", "Comments")}</span>
              <strong>{formatNumber(video.comments)}</strong>
            </li>
            <li>
              <span>{t("Shares und Saves", "Shares and saves")}</span>
              <strong>{formatNumber(video.shares + video.saves)}</strong>
            </li>
            <li>
              <span>{t("Engagement", "Engagement")}</span>
              <strong>
                {formatPercent(engagement)}
                {metrics ? ` (${t("Schnitt", "average")} ${formatPercent(metrics.engagementRate)})` : ""}
              </strong>
            </li>
            <li>
              <span>{t("Länge", "Length")}</span>
              <strong>
                {formatDuration(video.durationSec)}
                {bucket ? ` (${t("Fenster", "window")} ${bucket.label}, ${formatCompact(bucket.avgViews)} ${t("Views", "views")})` : ""}
              </strong>
            </li>
            <li>
              <span>{t("Hashtags", "Hashtags")}</span>
              <strong>
                {video.hashtags.length}
                {metrics ? ` (${t("Schnitt", "average")} ${formatDecimal(metrics.hookSignals.avgHashtags, 1)})` : ""}
              </strong>
            </li>
            <li>
              <span>{t("Gepostet", "Posted")}</span>
              <strong>
                {weekday}
                {slot ? `, ${slot.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}
                {bestHour ? ` (${t("bester Slot", "best slot")} ${String(bestHour.hour).padStart(2, "0")}:00)` : ""}
              </strong>
            </li>
          </ul>

          {!metrics && (
            <Alert kind="info">
              {t(
                "Ohne Scan gibt es keinen Vergleich. Scanne den Account, dann stehen Median, Engagement und Längenfenster daneben.",
                "Without a scan there is nothing to compare. Scan the account and the median, engagement and length windows appear next to it.",
              )}
            </Alert>
          )}
        </div>
      )}
    </Section>
  );
}
