import { useEffect, useState } from "react";
import type { Account } from "../types";
import { formatDateTime, formatNumber, formatPercent, formatSigned } from "../format";
import { activeLanguage, useLang, useT, type Lang } from "../lang";
import { Badge } from "./ui";

export type MetricKey = "followers" | "hearts" | "videos" | "following" | "engagementRate" | "score";

type MetricDef = {
  key: MetricKey;
  de: { label: string; short: string; description: string };
  en: { label: string; short: string; description: string };
  format: (value: number) => string;
  deltaFormat: (value: number) => string;
};

const METRICS: MetricDef[] = [
  {
    key: "followers",
    de: {
      label: "Follower",
      short: "Follower",
      description:
        "Accounts, die dir folgen. TikTok gibt keine Historie heraus – jeder Punkt entsteht aus einer eigenen Messung. Je öfter du „Alle messen“ klickst, desto genauer die Kurve.",
    },
    en: {
      label: "Followers",
      short: "Followers",
      description:
        "Accounts that follow you. TikTok hands out no history, so every point comes from a measurement of your own. The more often you press \"Measure all\", the more precise the curve.",
    },
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "hearts",
    de: {
      label: "Likes gesamt",
      short: "Likes",
      description:
        "Summe aller Herzen auf allen deinen Videos. Steigt auch ohne neue Follower, wenn alte Videos weiter Likes sammeln – ein guter Frühindikator für Reichweite.",
    },
    en: {
      label: "Likes in total",
      short: "Likes",
      description:
        "The sum of all hearts on all your videos. It rises without new followers when older videos keep collecting likes, which makes it a good early indicator for reach.",
    },
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "videos",
    de: {
      label: "Videos",
      short: "Videos",
      description: "Anzahl veröffentlichter Videos. Zusammen mit den Followern zeigt sich, ob du mehr postest, ohne zu wachsen.",
    },
    en: {
      label: "Videos",
      short: "Videos",
      description: "How many videos you published. Together with followers it shows whether you post more without growing.",
    },
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "following",
    de: {
      label: "Folgt selbst",
      short: "Following",
      description:
        "Accounts, denen du folgst. Ein starkes Ungleichgewicht kann auf Follow-for-Follow hindeuten – das verwässert die Reichweite deiner Videos.",
    },
    en: {
      label: "Following",
      short: "Following",
      description:
        "Accounts you follow. A strong imbalance can point to follow-for-follow, which dilutes the reach of your videos.",
    },
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "engagementRate",
    de: {
      label: "Engagement-Rate",
      short: "Engagement",
      description:
        "Interaktionen (Likes, Kommentare, Shares, Saves) geteilt durch Views, gemessen an deinen gescannten Videos. Diese Zahl sagt mehr als Follower, weil sie zeigt, ob Inhalte wirklich ankommen.",
    },
    en: {
      label: "Engagement rate",
      short: "Engagement",
      description:
        "Interactions (likes, comments, shares, saves) divided by views, measured on the videos you scanned. This number says more than followers because it shows whether the content lands.",
    },
    format: (value) => formatPercent(value),
    deltaFormat: (value) => {
      const locale = activeLanguage() === "en" ? "en-US" : "de-DE";
      const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
      return `${value > 0 ? "+" : ""}${number} ${activeLanguage() === "en" ? "pp" : "Pp."}`;
    },
  },
  {
    key: "score",
    de: {
      label: "Growth-Score",
      short: "Score",
      description:
        "0–100 aus Engagement, Views pro Follower und Posting-Rhythmus. Kein TikTok-Wert, sondern eine eigene Kennzahl, damit du Fortschritt über Zeit vergleichen kannst.",
    },
    en: {
      label: "Growth score",
      short: "Score",
      description:
        "0–100 from engagement, views per follower and posting rhythm. Not a TikTok number but one of our own, so you can compare progress over time.",
    },
    format: (value) => `${Math.round(value)}/100`,
    deltaFormat: (value) => formatSigned(value),
  },
];

const defFor = (key: MetricKey): MetricDef => METRICS.find((entry) => entry.key === key) ?? METRICS[0];

const texts = (definition: MetricDef, lang: Lang) => (lang === "en" ? definition.en : definition.de);

export function AccountDetails({
  account,
  initialMetric,
  onClose,
}: {
  account: Account;
  initialMetric: MetricKey;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [metric, setMetric] = useState<MetricKey>(initialMetric);

  useEffect(() => setMetric(initialMetric), [initialMetric]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const definition = defFor(metric);
  const series = account.history
    .map((snapshot) => ({ at: snapshot.at, value: snapshot[metric] as number | null }))
    .filter((point): point is { at: number; value: number } => point.value !== null && Number.isFinite(point.value));

  const current = series.length > 0 ? series[series.length - 1].value : null;
  const oldest = series.length > 0 ? series[0].value : null;
  const delta = current !== null && oldest !== null ? current - oldest : null;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const weekReference = [...series].reverse().find((point) => point.at <= weekAgo);
  const delta7 = current !== null && weekReference ? current - weekReference.value : null;
  const best = series.length > 0 ? Math.max(...series.map((point) => point.value)) : null;

  const counts = {
    followers: account.latest?.followers ?? null,
    hearts: account.latest?.hearts ?? null,
    videos: account.latest?.videos ?? null,
    following: account.latest?.following ?? null,
    engagementRate: account.latest?.engagementRate ?? null,
    score: account.latest?.score ?? null,
  } as Record<MetricKey, number | null>;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(`Werte von @${account.handle}`, `Values for @${account.handle}`)}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>@{account.handle}</h2>
            <p className="muted small">{account.nickname || t("Werte im Detail", "Values in detail")}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t("Schließen", "Close")}>
            {t("schließen", "close")} ✕
          </button>
        </header>

        <div className="metric-tiles">
          {METRICS.map((entry) => {
            const value = counts[entry.key];
            const local = texts(entry, lang);
            return (
              <button
                key={entry.key}
                type="button"
                className={`metric-tile${entry.key === metric ? " metric-tile-active" : ""}`}
                onClick={() => setMetric(entry.key)}
                title={local.description}
              >
                <span className="stat-label">{local.label}</span>
                <strong className="num">{value === null ? "–" : entry.format(value)}</strong>
                <span className="muted small">
                  {account.history.length} {t("Messpunkte", "measurements")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="metric-detail">
          <div className="row spread wrap">
            <h3>{texts(definition, lang).label}</h3>
            <Badge tone={delta === null ? "neutral" : delta > 0 ? "good" : delta < 0 ? "warn" : "neutral"}>
              {delta === null
                ? t("kein Verlauf", "no history")
                : t(
                    `${definition.deltaFormat(delta)} seit erstem Messpunkt`,
                    `${definition.deltaFormat(delta)} since the first measurement`,
                  )}
            </Badge>
          </div>
          <p className="muted small">{texts(definition, lang).description}</p>

          <dl className="chart-meta">
            <div>
              <dt>{t("Aktuell", "Current")}</dt>
              <dd>{current === null ? "–" : definition.format(current)}</dd>
            </div>
            <div>
              <dt>{t("7 Tage", "7 days")}</dt>
              <dd>{delta7 === null ? "–" : definition.deltaFormat(delta7)}</dd>
            </div>
            <div>
              <dt>{t("Höchstwert", "Peak")}</dt>
              <dd>{best === null ? "–" : definition.format(best)}</dd>
            </div>
            <div>
              <dt>{t("Messpunkte", "Measurements")}</dt>
              <dd>{series.length}</dd>
            </div>
          </dl>

          {series.length < 2 ? (
            <p className="muted small">
              {t(
                "Für eine Kurve fehlen Messungen. Klicke oben auf „Alle messen“ – jeder Durchlauf fügt einen Punkt hinzu.",
                "A curve needs more measurements. Press \"Measure all\" above, every run adds a point.",
              )}
            </p>
          ) : (
            <ValueChart series={series} format={definition.format} />
          )}

          {series.length > 0 && (
            <div className="table-scroll measure-scroll">
              <table className="measure-table">
                <thead>
                  <tr>
                    <th>{t("Messung", "Measurement")}</th>
                    <th className="right">{texts(definition, lang).short}</th>
                    <th className="right">{t("Änderung", "Change")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map((point, index, list) => {
                    const previous = list[index + 1];
                    const change = previous ? point.value - previous.value : null;
                    return (
                      <tr key={point.at}>
                        <td className="nowrap muted small">{formatDateTime(point.at)}</td>
                        <td className="right strong num">{definition.format(point.value)}</td>
                        <td className={`right num ${change && change > 0 ? "text-good" : change && change < 0 ? "text-bad" : "muted"}`}>
                          {change === null ? "–" : definition.deltaFormat(change)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ValueChart({ series, format }: { series: { at: number; value: number }[]; format: (value: number) => string }) {
  const t = useT();
  const width = 600;
  const height = 150;
  const padding = 8;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.05);
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;

  const coords = series.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
    return { x, y, ...point };
  });

  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${(padding + (series.length - 1) * step).toFixed(1)},${height - padding}`;
  const rising = series[series.length - 1].value >= series[0].value;

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("Verlauf", "History")}>
        <polygon points={area} fill={rising ? "rgba(143, 191, 149, 0.14)" : "rgba(207, 133, 124, 0.14)"} />
        <polyline
          points={line}
          fill="none"
          stroke={rising ? "var(--good)" : "var(--bad)"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((point) => (
          <circle key={point.at} cx={point.x} cy={point.y} r="3" fill="var(--card)" stroke={rising ? "var(--good)" : "var(--bad)"} strokeWidth="2">
            <title>{`${formatDateTime(point.at)} · ${format(point.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-axis muted small">
        <span>{formatDateTime(series[0].at)}</span>
        <span>
          {format(min)} – {format(max)}
        </span>
        <span>{formatDateTime(series[series.length - 1].at)}</span>
      </div>
    </div>
  );
}

export type { MetricDef };
