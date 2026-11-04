import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { formatCompact, formatDate, formatDecimal, formatNumber } from "../format";
import { useT } from "../lang";
import type { PublicSettings, ScanResult } from "../types";
import { Alert, Section, Spinner } from "./ui";

/**
 * Ziel-Rechner: aus Ziel, Datum und den eigenen Zahlen wird eine Aufgabe pro
 * Woche. Rechnet mit dem letzten Scan, nicht mit Wunschwerten.
 */

const today = () => new Date(new Date().toDateString());
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

export function GoalCard({ scan }: { scan: ScanResult | null }) {
  const t = useT();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [goal, setGoal] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settings()
      .then((data) => {
        setSettings(data);
        setGoal(data.goalFollowers ? String(data.goalFollowers) : "");
        setDate(data.goalDate);
      })
      .catch(() => setSettings(null));
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const parsed = Number.parseInt(goal.replace(/[^\d]/g, ""), 10);
      const next = await api.saveSettings({
        goalFollowers: Number.isFinite(parsed) ? parsed : 0,
        goalDate: date,
      });
      setSettings(next);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const followers = scan?.profile.followers ?? null;
  const metrics = scan?.metrics ?? null;
  const target = Number.parseInt(goal.replace(/[^\d]/g, ""), 10);
  const days = date ? daysBetween(today(), new Date(`${date}T12:00:00`)) : 0;
  const missing = followers !== null && Number.isFinite(target) ? target - followers : null;
  const perDay = missing !== null && days > 0 ? missing / days : null;
  const perWeek = perDay !== null ? perDay * 7 : null;
  const viewsPerFollower = metrics?.viewsPerFollower ?? null;
  const avgViews = metrics?.avgViews ?? 0;
  const postsPerWeek =
    perWeek !== null && viewsPerFollower !== null && avgViews > 0 ? (perWeek * viewsPerFollower) / avgViews : null;

  return (
    <Section
      title={t("Ziel-Rechner", "Goal calculator")}
      subtitle={t(
        "Ziel und Datum eintragen: daraus wird, wie viele Follower, Views und Posts pro Woche nötig sind.",
        "Enter a target and a date and the app works out how many followers, views and posts per week that takes.",
      )}
      actions={
        <button className="btn btn-sm" onClick={() => void save()} disabled={busy}>
          {busy ? <Spinner label={t("Speichere…", "Saving…")} /> : t("Ziel speichern", "Save goal")}
        </button>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid-two">
        <label className="field">
          <span>{t("Ziel-Follower", "Target followers")}</span>
          <input value={goal} onChange={(event) => setGoal(event.target.value)} inputMode="numeric" placeholder="10000" />
        </label>
        <label className="field">
          <span>{t("Bis wann", "By when")}</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      {!scan && (
        <Alert kind="info">
          {t(
            "Der Rechner braucht einen Scan: daraus kommen aktuelle Follower, durchschnittliche Views und Views pro Follower.",
            "The calculator needs a scan: it takes your current followers, average views and views per follower from it.",
          )}
        </Alert>
      )}

      {scan && followers !== null && (
        <ul className="kv">
          <li>
            <span>{t("Heute", "Today")}</span>
            <strong>{formatNumber(followers)}</strong>
          </li>
          <li>
            <span>{t("Noch nötig", "Still needed")}</span>
            <strong>{missing !== null && missing > 0 ? `+${formatNumber(missing)}` : t("Ziel erreicht oder darunter", "goal reached or below")}</strong>
          </li>
          <li>
            <span>{t("Tage", "Days")}</span>
            <strong>{days > 0 ? formatNumber(days) : t("Datum fehlt oder liegt zurück", "date missing or in the past")}</strong>
          </li>
          <li>
            <span>{t("Follower pro Tag", "Followers per day")}</span>
            <strong>{perDay !== null && perDay > 0 ? formatDecimal(perDay, 1) : "–"}</strong>
          </li>
          <li>
            <span>{t("Follower pro Woche", "Followers per week")}</span>
            <strong>{perWeek !== null && perWeek > 0 ? formatNumber(perWeek) : "–"}</strong>
          </li>
          <li>
            <span>{t("Views pro Woche", "Views per week")}</span>
            <strong>
              {perWeek !== null && perWeek > 0 && viewsPerFollower !== null
                ? formatCompact(perWeek * viewsPerFollower)
                : "–"}
            </strong>
          </li>
          <li>
            <span>{t("Posts pro Woche", "Posts per week")}</span>
            <strong>{postsPerWeek !== null && postsPerWeek > 0 ? formatDecimal(postsPerWeek, 1) : "–"}</strong>
          </li>
          <li>
            <span>{t("Basis", "Basis")}</span>
            <strong>
              {formatCompact(avgViews)} {t("Views je Video", "views per video")}
            </strong>
          </li>
        </ul>
      )}

      {postsPerWeek !== null && postsPerWeek > 14 && (
        <Alert kind="warn">
          {t(
            "Das sind mehr als zwei Posts am Tag. Entweder das Ziel weiter nach hinten legen oder die Zahl realistischer setzen.",
            "That is more than two posts a day. Move the goal further out or set a more realistic number.",
          )}
        </Alert>
      )}

      {settings?.goalDate ? (
        <p className="muted small">
          {t(`Gespeichertes Ziel: ${formatNumber(settings.goalFollowers)} bis ${formatDate(Date.parse(`${settings.goalDate}T12:00:00`) / 1000)}.`, `Stored goal: ${formatNumber(settings.goalFollowers)} by ${formatDate(Date.parse(`${settings.goalDate}T12:00:00`) / 1000)}.`)}
        </p>
      ) : null}
    </Section>
  );
}
