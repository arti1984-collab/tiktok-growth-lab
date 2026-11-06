import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { formatCompact, formatDate, formatDecimal, formatNumber, formatSigned } from "../format";
import { useT } from "../lang";
import type { Account, Goal, PublicSettings, ScanResult } from "../types";
import { Alert, Chevron, ProgressBar, Section, Spinner } from "./ui";

/**
 * Ziel-Rechner: ein Ziel gehoert zu einem Profil. Aus Ziel, Datum und den
 * Zahlen des Profils wird eine Aufgabe pro Woche, und der Startpunkt zeigt,
 * wie viel seit dem Zielstart dazugekommen ist.
 */

const today = () => new Date(new Date().toDateString());
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

/** Zuklapp-Zustand, der den Reiterwechsel und das Neuladen uebersteht. */
function useStoredOpen(key: string, fallback: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : stored === "1";
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, open ? "1" : "0");
    } catch {
      // Ohne Speicher gilt der Zustand nur bis zum Neuladen.
    }
  }, [key, open]);
  return [open, () => setOpen((current) => !current)] as const;
}

type GoalProfile = {
  handle: string;
  nickname: string;
  followers: number | null;
  /** Messpunkte im Verlauf; 1 heisst: nur der aktuelle Scan. */
  measurements: number;
};

export function GoalCard({ scan, accounts }: { scan: ScanResult | null; accounts: Account[] }) {
  const t = useT();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [selected, setSelected] = useState("");
  const [goal, setGoal] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, toggleOpen] = useStoredOpen("goalCard.open", true);
  const [showValues, toggleValues] = useStoredOpen("goalCard.values", true);

  useEffect(() => {
    api
      .settings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  /** Scan-Profil und Watchlist zusammen, je Handle nur einmal. */
  const profiles = useMemo(() => {
    const list: GoalProfile[] = [];
    if (scan) {
      list.push({
        handle: scan.profile.handle,
        nickname: scan.profile.nickname,
        followers: scan.profile.followers,
        measurements: 1,
      });
    }
    for (const account of accounts) {
      const existing = list.find((entry) => entry.handle.toLowerCase() === account.handle.toLowerCase());
      const followers = account.latest?.followers ?? null;
      if (existing) {
        // Der Scan hat die frischeste Zahl, die Watchlist die Messreihe.
        if (followers !== null) existing.followers = followers;
        existing.measurements = account.history.length;
        continue;
      }
      list.push({
        handle: account.handle,
        nickname: account.nickname,
        followers,
        measurements: account.history.length,
      });
    }
    return list;
  }, [scan, accounts]);

  // Ohne Auswahl das Profil mit gespeichertem Ziel nehmen, sonst das erste.
  useEffect(() => {
    setSelected((current) => {
      if (profiles.some((entry) => entry.handle.toLowerCase() === current)) return current;
      const saved = settings?.goals.find((entry) =>
        profiles.some((profile) => profile.handle.toLowerCase() === entry.handle),
      );
      return (saved?.handle ?? profiles[0]?.handle ?? "").toLowerCase();
    });
  }, [profiles, settings]);

  const saved: Goal | null = settings?.goals.find((entry) => entry.handle === selected) ?? null;
  const profile = profiles.find((entry) => entry.handle.toLowerCase() === selected) ?? null;

  // Die Felder zeigen immer das Ziel des gewaehlten Profils.
  useEffect(() => {
    if (!selected) {
      setGoal("");
      setDate("");
      return;
    }
    if (saved) {
      setGoal(String(saved.followers));
      setDate(saved.date);
      return;
    }
    // Ein Ziel aus der Zeit vor den Profilen bleibt als Vorlage in den Feldern.
    if (settings && settings.goals.length === 0 && settings.goalFollowers > 0) {
      setGoal(String(settings.goalFollowers));
      setDate(settings.goalDate);
      return;
    }
    setGoal("");
    setDate("");
  }, [selected, settings]);

  async function save() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = Number.parseInt(goal.replace(/[^\d]/g, ""), 10);
      const next = await api.saveSettings({
        goal: {
          handle: profile.handle,
          followers: Number.isFinite(parsed) ? parsed : 0,
          date,
          startFollowers: profile.followers ?? 0,
        },
      });
      setSettings(next);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      setSettings(await api.saveSettings({ removeGoal: profile.handle }));
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const followers = profile?.followers ?? null;
  const scannedHere = Boolean(scan && profile && scan.profile.handle.toLowerCase() === profile.handle.toLowerCase());
  const metrics = scannedHere ? (scan?.metrics ?? null) : null;
  const target = Number.parseInt(goal.replace(/[^\d]/g, ""), 10);
  const days = date ? daysBetween(today(), new Date(`${date}T12:00:00`)) : 0;
  const missing = followers !== null && Number.isFinite(target) ? target - followers : null;
  const perDay = missing !== null && days > 0 ? missing / days : null;
  const perWeek = perDay !== null ? perDay * 7 : null;
  const viewsPerFollower = metrics?.viewsPerFollower ?? null;
  const avgViews = metrics?.avgViews ?? 0;
  const postsPerWeek =
    perWeek !== null && viewsPerFollower !== null && avgViews > 0 ? (perWeek * viewsPerFollower) / avgViews : null;
  const start = saved && saved.startFollowers > 0 ? saved.startFollowers : null;
  const grown = start !== null && followers !== null ? followers - start : null;
  const span = start !== null && Number.isFinite(target) ? target - start : 0;

  return (
    <Section
      title={t("Ziel-Rechner", "Goal calculator")}
      collapsible
      collapsed={!open}
      onToggle={toggleOpen}
      subtitle={t(
        "Profil wählen, Ziel und Datum eintragen: daraus wird, wie viele Follower, Views und Posts pro Woche nötig sind und wie viel seit dem Zielstart dazukam.",
        "Pick a profile, enter a target and a date: that becomes the followers, views and posts per week it takes, plus how much has come in since the goal started.",
      )}
      actions={
        <>
          {saved && (
            <button className="btn btn-ghost btn-sm" onClick={() => void forget()} disabled={busy}>
              {t("Ziel entfernen", "Remove goal")}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => void save()} disabled={busy || !profile}>
            {busy ? <Spinner label={t("Speichere…", "Saving…")} /> : t("Ziel speichern", "Save goal")}
          </button>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}

      {profiles.length > 0 && (
        <label className="field">
          <span>{t("Profil mit Ziel", "Profile with the goal")}</span>
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {profiles.map((entry) => (
              <option key={entry.handle} value={entry.handle.toLowerCase()}>
                {`@${entry.handle}${
                  entry.followers !== null ? ` · ${formatNumber(entry.followers)} ${t("Follower", "followers")}` : ""
                }`}
              </option>
            ))}
          </select>
        </label>
      )}

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

      {profiles.length === 0 && (
        <Alert kind="info">
          {t(
            "Der Rechner braucht ein Profil: scanne dein Konto oder lege es in der Watchlist an. Daraus kommen die aktuellen Follower.",
            "The calculator needs a profile: scan your account or put it on the watchlist. Your current followers come from there.",
          )}
        </Alert>
      )}

      {profile && (
        <button
          type="button"
          className="values-toggle"
          aria-expanded={showValues}
          onClick={toggleValues}
        >
          <span className="row gap-sm center">
            <Chevron open={showValues} />
            <strong>@{profile.handle}</strong>
          </span>
          <span className="row gap-sm center muted small">
            {profile.followers !== null && (
              <span>
                {formatNumber(profile.followers)} {t("Follower", "followers")}
              </span>
            )}
            <span>{showValues ? t("Werte ausblenden", "Hide values") : t("Werte anzeigen", "Show values")}</span>
          </span>
        </button>
      )}

      {showValues && profile && followers !== null && (
        <ul className="kv">
          <li>
            <span>{t("Heute", "Today")}</span>
            <strong>{formatNumber(followers)}</strong>
          </li>
          {saved && start !== null && grown !== null && (
            <li>
              <span>
                {t(
                  `Seit Zielstart (${formatDate(saved.startedAt / 1000)})`,
                  `Since the goal started (${formatDate(saved.startedAt / 1000)})`,
                )}
              </span>
              <strong className={grown >= 0 ? "text-good" : "text-bad"}>{formatSigned(grown)}</strong>
            </li>
          )}
          <li>
            <span>{t("Noch nötig", "Still needed")}</span>
            <strong>
              {missing !== null && missing > 0
                ? `+${formatNumber(missing)}`
                : t("Ziel erreicht oder darunter", "goal reached or below")}
            </strong>
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
              {avgViews > 0 ? (
                <>
                  {formatCompact(avgViews)} {t("Views je Video", "views per video")}
                </>
              ) : (
                t("noch kein Scan für dieses Profil", "no scan for this profile yet")
              )}
            </strong>
          </li>
        </ul>
      )}

      {showValues && start !== null && followers !== null && grown !== null && span > 0 && (
        <div className="stack-tight">
          <ProgressBar
            value={followers - start}
            max={span}
            label={t("Fortschritt zum Ziel", "Progress toward the goal")}
          />
          <p className="muted small">
            {t(
              `${formatNumber(start)} bei Zielstart, jetzt ${formatNumber(followers)}: ${
                span > 0 ? `${Math.round(Math.max(0, Math.min(100, ((followers - start) / span) * 100)))} % des Wegs` : ""
              }.`,
              `${formatNumber(start)} when the goal started, now ${formatNumber(followers)}: ${
                span > 0 ? `${Math.round(Math.max(0, Math.min(100, ((followers - start) / span) * 100)))}% of the way` : ""
              }.`,
            )}
          </p>
        </div>
      )}

      {showValues && saved && start === null && (
        <p className="muted small">
          {t(
            "Für dieses Ziel gibt es noch keinen Startpunkt. Er entsteht beim nächsten Speichern mit den aktuellen Followern.",
            "This goal has no starting point yet. It is recorded the next time you save with the current followers.",
          )}
        </p>
      )}

      {showValues && profile && !scannedHere && (
        <p className="muted small">
          {t(
            "Views pro Video und Views pro Follower kommen aus dem letzten Scan. Für ein anderes Profil bleiben Views und Posts pro Woche leer, bis du es selbst scannst.",
            "Views per video and views per follower come from the last scan. For another profile, views and posts per week stay empty until you scan it yourself.",
          )}
        </p>
      )}

      {showValues && postsPerWeek !== null && postsPerWeek > 14 && (
        <Alert kind="warn">
          {t(
            "Das sind mehr als zwei Posts am Tag. Entweder das Ziel weiter nach hinten legen oder die Zahl realistischer setzen.",
            "That is more than two posts a day. Move the goal further out or set a more realistic number.",
          )}
        </Alert>
      )}

      {showValues &&
        (saved ? (
        <p className="muted small">
          {t(
            `Gespeichertes Ziel für @${saved.handle}: ${formatNumber(saved.followers)} bis ${formatDate(
              Date.parse(`${saved.date}T12:00:00`) / 1000,
            )}.`,
            `Stored goal for @${saved.handle}: ${formatNumber(saved.followers)} by ${formatDate(
              Date.parse(`${saved.date}T12:00:00`) / 1000,
            )}.`,
          )}
        </p>
      ) : settings?.goalDate ? (
        <p className="muted small">
          {t(
            "Das bisherige Ziel ohne Profil steht als Vorlage in den Feldern. Speichern hängt es an das gewählte Profil.",
            "The previous goal without a profile sits in the fields as a template. Saving attaches it to the selected profile.",
          )}
        </p>
        ) : null)}
    </Section>
  );
}
