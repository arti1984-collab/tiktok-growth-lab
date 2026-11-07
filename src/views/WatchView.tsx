import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { formatCompact, formatDateTime, formatSigned, formatNumber } from "../format";
import { useT } from "../lang";
import type { Account, ScanResult } from "../types";
import { PlanCard } from "../components/PlanCard";
import { GoalCard } from "../components/GoalCard";
import { Alert, EmptyState, Section, Sparkline, Spinner } from "../components/ui";
import { AccountDetails, type MetricKey } from "../components/AccountDetails";

export function WatchView({ scan }: { scan: ScanResult | null }) {
  const t = useT();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ handle: string; metric: MetricKey } | null>(null);

  useEffect(() => {
    api
      .watchlist()
      .then((data) => setAccounts(data.accounts))
      .catch((caught: ApiError) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  // Keep the open detail in sync after a refresh.
  const detailAccount = detail ? accounts.find((account) => account.handle === detail.handle) ?? null : null;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!handle.trim() || busy) return;
    setBusy("add");
    setError(null);
    try {
      const data = await api.track(handle.trim());
      setAccounts(data.accounts);
      setHandle("");
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    setError(null);
    try {
      const data = await api.refreshWatchlist();
      setAccounts(data.accounts);
      if (data.errors.length > 0) {
        setError(data.errors.map((entry) => `@${entry.handle}: ${entry.message}`).join(" · "));
      }
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(target: string) {
    setBusy(`remove-${target}`);
    try {
      const data = await api.untrack(target);
      setAccounts(data.accounts);
      if (detail?.handle === target) setDetail(null);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <Section
        title={t("Wachstums-Tracking", "Growth tracking")}
        subtitle={t(
          "Follower-Verlauf deiner Accounts und Wettbewerber. Jeder Scan und jede Aktualisierung erzeugt einen Messpunkt.",
          "Follower history for your accounts and competitors. Every scan and every refresh adds a measurement.",
        )}
        actions={
          <button className="btn" onClick={refresh} disabled={busy !== null || accounts.length === 0}>
            {busy === "refresh" ? <Spinner label={t("Aktualisiere…", "Refreshing…")} /> : t("Alle messen", "Measure all")}
          </button>
        }
      >
        <form className="row gap wrap" onSubmit={add}>
          <input
            className="inline-input"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder={t("@account hinzufügen", "add @account")}
            spellCheck={false}
          />
          <button className="btn btn-primary" type="submit" disabled={busy !== null || !handle.trim()}>
            {busy === "add" ? <Spinner label={t("Lade…", "Loading…")} /> : t("Hinzufügen", "Add")}
          </button>
        </form>
        {error && <Alert kind="error">{error}</Alert>}
      </Section>

      {loading ? (
        <Section>
          <Spinner label={t("Lade Watchlist…", "Loading watchlist…")} />
        </Section>
      ) : accounts.length === 0 ? (
        <EmptyState
          title={t("Watchlist ist leer", "The watchlist is empty")}
          text={t(
            "Füge Accounts hinzu, um Follower-Entwicklung über Zeit zu messen. Ohne Messpunkte gibt es kein Wachstum zu sehen – TikTok liefert keine Historie.",
            "Add accounts to measure follower growth over time. Without measurements there is no growth to see, since TikTok hands out no history.",
          )}
        />
      ) : (
        <Section title={t(`${accounts.length} getrackte Accounts`, `${accounts.length} tracked accounts`)}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Account", "Account")}</th>
                  <th className="right">{t("Follower", "Followers")}</th>
                  <th className="right">{t("7 Tage", "7 days")}</th>
                  <th className="right">{t("Gesamt", "Total")}</th>
                  <th className="right">{t("Videos", "Videos")}</th>
                  <th>{t("Verlauf", "History")}</th>
                  <th>{t("Letzte Messung", "Last measurement")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.handle}>
                    <td>
                      <div className="row gap-sm center">
                        {account.avatar ? <img className="avatar sm" src={account.avatar} alt="" referrerPolicy="no-referrer" /> : <div className="avatar sm" />}
                        <div className="stack-tight">
                          <a href={`https://www.tiktok.com/@${account.handle}`} target="_blank" rel="noreferrer">
                            @{account.handle}
                          </a>
                          <span className="muted small">{account.nickname}</span>
                        </div>
                      </div>
                    </td>
                    <td className="right strong">
                      <button
                        className="value-btn"
                        onClick={() => setDetail({ handle: account.handle, metric: "followers" })}
                        title={t("Follower-Verlauf ansehen", "Show the follower history")}
                      >
                        {formatNumber(account.latest?.followers ?? null)}
                      </button>
                    </td>
                    <td className={`right ${(account.delta7 ?? 0) > 0 ? "text-good" : (account.delta7 ?? 0) < 0 ? "text-bad" : ""}`}>
                      <button
                        className="value-btn"
                        onClick={() => setDetail({ handle: account.handle, metric: "followers" })}
                        title={t("Follower-Veränderung im Detail", "Follower change in detail")}
                      >
                        {formatSigned(account.delta7)}
                      </button>
                    </td>
                    <td className={`right ${(account.deltaAll ?? 0) > 0 ? "text-good" : (account.deltaAll ?? 0) < 0 ? "text-bad" : ""}`}>
                      <button
                        className="value-btn"
                        onClick={() => setDetail({ handle: account.handle, metric: "followers" })}
                        title={t("Follower seit dem ersten Messpunkt", "Followers since the first measurement")}
                      >
                        {formatSigned(account.deltaAll)}
                      </button>
                    </td>
                    <td className="right">
                      <button
                        className="value-btn"
                        onClick={() => setDetail({ handle: account.handle, metric: "videos" })}
                        title={t("Video-Anzahl im Verlauf", "Video count over time")}
                      >
                        {formatCompact(account.latest?.videos ?? null)}
                      </button>
                    </td>
                    <td>
                      <Sparkline points={account.points.map((point) => point.followers)} />
                    </td>
                    <td className="nowrap muted small">{account.latest ? formatDateTime(account.latest.at) : "–"}</td>
                    <td className="right">
                      <div className="row gap-sm end-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDetail({ handle: account.handle, metric: "followers" })}
                          title={t("Alle Werte dieses Accounts ansehen", "Show every value of this account")}
                        >
                          {t("Werte", "Values")}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => remove(account.handle)}
                          disabled={busy !== null}
                          title={t("Aus Watchlist entfernen", "Remove from the watchlist")}
                        >
                          {t("entfernen", "remove")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            {t(
              "Auf jede Zahl klicken, um ihren Verlauf zu öffnen – Follower, Likes, Videos, Folgt-selbst, Engagement-Rate und Score. Nach jedem eigenen Upload einmal „Alle messen“ klicken, so entsteht eine echte Kurve.",
              "Click any number to open its history: followers, likes, videos, following, engagement rate and score. Press \"Measure all\" after every upload of your own and a real curve builds up.",
            )}
          </p>
        </Section>
      )}

      <PlanCard scan={scan} />
      <GoalCard scan={scan} accounts={accounts} />

      {detailAccount && (
        <AccountDetails
          account={detailAccount}
          initialMetric={detail?.metric ?? "followers"}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
