import { useEffect, useState } from "react";
import type { Account } from "../types";
import { formatDateTime, formatNumber, formatPercent, formatSigned } from "../format";
import { Badge } from "./ui";

export type MetricKey = "followers" | "hearts" | "videos" | "following" | "engagementRate" | "score";

type MetricDef = {
  key: MetricKey;
  label: string;
  short: string;
  description: string;
  format: (value: number) => string;
  deltaFormat: (value: number) => string;
};

const METRICS: MetricDef[] = [
  {
    key: "followers",
    label: "Follower",
    short: "Follower",
    description:
      "Accounts, die dir folgen. TikTok gibt keine Historie heraus – jeder Punkt entsteht aus einer eigenen Messung. Je öfter du „Alle messen“ klickst, desto genauer die Kurve.",
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "hearts",
    label: "Likes gesamt",
    short: "Likes",
    description:
      "Summe aller Herzen auf allen deinen Videos. Steigt auch ohne neue Follower, wenn alte Videos weiter Likes sammeln – ein guter Frühindikator für Reichweite.",
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "videos",
    label: "Videos",
    short: "Videos",
    description: "Anzahl veröffentlichter Videos. Zusammen mit den Followern zeigt sich, ob du mehr postest, ohne zu wachsen.",
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "following",
    label: "Folgt selbst",
    short: "Following",
    description:
      "Accounts, denen du folgst. Ein starkes Ungleichgewicht kann auf Follow-for-Follow hindeuten – das verwässert die Reichweite deiner Videos.",
    format: (value) => formatNumber(value),
    deltaFormat: (value) => formatSigned(value),
  },
  {
    key: "engagementRate",
    label: "Engagement-Rate",
    short: "Engagement",
    description:
      "Interaktionen (Likes, Kommentare, Shares, Saves) geteilt durch Views, gemessen an deinen gescannten Videos. Diese Zahl sagt mehr als Follower, weil sie zeigt, ob Inhalte wirklich ankommen.",
    format: (value) => formatPercent(value),
    deltaFormat: (value) => `${value > 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")} pp`,
  },
  {
    key: "score",
    label: "Growth-Score",
    short: "Score",
    description:
      "0–100 aus Engagement, Views pro Follower und Posting-Rhythmus. Kein TikTok-Wert, sondern eine eigene Kennzahl, damit du Fortschritt über Zeit vergleichen kannst.",
    format: (value) => `${Math.round(value)}/100`,
    deltaFormat: (value) => formatSigned(value),
  },
];

const metricFor = (key: MetricKey) => METRICS.find((entry) => entry.key === key) ?? METRICS[0];

export function AccountDetails({
  account,
  initialMetric,
  onClose,
}: {
  account: Account;
  initialMetric: MetricKey;
  onClose: () => void;
}) {
  const [metric, setMetric] = useState<MetricKey>(initialMetric);

  useEffect(() => setMetric(initialMetric), [initialMetric]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const definition = metricFor(metric);
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
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Werte von @${account.handle}`} onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>@{account.handle}</h2>
            <p className="muted small">{account.nickname || "Werte im Detail"}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Schließen">
            schließen ✕
          </button>
        </header>

        <div className="metric-tiles">
          {METRICS.map((entry) => {
            const value = counts[entry.key];
            return (
              <button
                key={entry.key}
                type="button"
                className={`metric-tile${entry.key === metric ? " metric-tile-active" : ""}`}
                onClick={() => setMetric(entry.key)}
                title={entry.description}
              >
                <span className="stat-label">{entry.label}</span>
                <strong className="num">{value === null ? "–" : entry.format(value)}</strong>
                <span className="muted small">{account.history.length} Messpunkte</span>
              </button>
            );
          })}
        </div>

        <div className="metric-detail">
          <div className="row spread wrap">
            <h3>{definition.label}</h3>
            <Badge tone={delta === null ? "neutral" : delta > 0 ? "good" : delta < 0 ? "warn" : "neutral"}>
              {delta === null ? "kein Verlauf" : `${definition.deltaFormat(delta)} seit erstem Messpunkt`}
            </Badge>
          </div>
          <p className="muted small">{definition.description}</p>

          <dl className="chart-meta">
            <div>
              <dt>Aktuell</dt>
              <dd>{current === null ? "–" : definition.format(current)}</dd>
            </div>
            <div>
              <dt>7 Tage</dt>
              <dd>{delta7 === null ? "–" : definition.deltaFormat(delta7)}</dd>
            </div>
            <div>
              <dt>Höchstwert</dt>
              <dd>{best === null ? "–" : definition.format(best)}</dd>
            </div>
            <div>
              <dt>Messpunkte</dt>
              <dd>{series.length}</dd>
            </div>
          </dl>

          {series.length < 2 ? (
            <p className="muted small">
              Für eine Kurve fehlen Messungen. Klicke oben auf „Alle messen“ – jeder Durchlauf fügt einen Punkt hinzu.
            </p>
          ) : (
            <ValueChart series={series} format={definition.format} />
          )}

          {series.length > 0 && (
            <div className="table-scroll measure-scroll">
              <table className="measure-table">
                <thead>
                  <tr>
                    <th>Messung</th>
                    <th className="right">{definition.short}</th>
                    <th className="right">Änderung</th>
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
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Verlauf">
        <polygon points={area} fill={rising ? "rgba(55, 211, 153, 0.14)" : "rgba(242, 113, 113, 0.14)"} />
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
