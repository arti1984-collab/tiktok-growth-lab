import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { formatCompact, formatDateTime, formatSigned, formatNumber } from "../format";
import type { Account } from "../types";
import { Alert, EmptyState, Section, Sparkline, Spinner } from "../components/ui";
import { AccountDetails, type MetricKey } from "../components/AccountDetails";

export function WatchView() {
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
        title="Wachstums-Tracking"
        subtitle="Follower-Verlauf deiner Accounts und Wettbewerber. Jeder Scan und jede Aktualisierung erzeugt einen Messpunkt."
        actions={
          <button className="btn" onClick={refresh} disabled={busy !== null || accounts.length === 0}>
            {busy === "refresh" ? <Spinner label="Aktualisiere…" /> : "Alle messen"}
          </button>
        }
      >
        <form className="row gap wrap" onSubmit={add}>
          <input
            className="inline-input"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="@account hinzufügen"
            spellCheck={false}
          />
          <button className="btn btn-primary" type="submit" disabled={busy !== null || !handle.trim()}>
            {busy === "add" ? <Spinner label="Lade…" /> : "Hinzufügen"}
          </button>
        </form>
        {error && <Alert kind="error">{error}</Alert>}
      </Section>

      {loading ? (
        <Section>
          <Spinner label="Lade Watchlist…" />
        </Section>
      ) : accounts.length === 0 ? (
        <EmptyState
          title="Watchlist ist leer"
          text="Füge Accounts hinzu, um Follower-Entwicklung über Zeit zu messen. Ohne Messpunkte gibt es kein Wachstum zu sehen – TikTok liefert keine Historie."
        />
      ) : (
        <Section title={`${accounts.length} getrackte Accounts`}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="right">Follower</th>
                  <th className="right">7 Tage</th>
                  <th className="right">Gesamt</th>
                  <th className="right">Videos</th>
                  <th>Verlauf</th>
                  <th>Letzte Messung</th>
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
                        title="Follower-Verlauf ansehen"
                      >
                        {formatNumber(account.latest?.followers ?? null)}
                      </button>
                    </td>
                    <td className={`right ${(account.delta7 ?? 0) > 0 ? "text-good" : (account.delta7 ?? 0) < 0 ? "text-bad" : ""}`}>
                      <button
                        className="value-btn"
                        onClick={() => setDetail({ handle: account.handle, metric: "followers" })}
                        title="Follower-Veränderung im Detail"
                      >
                        {formatSigned(account.delta7)}
                      </button>
                    </td>
                    <td className={`right ${(account.deltaAll ?? 0) > 0 ? "text-good" : (account.deltaAll ?? 0) < 0 ? "text-bad" : ""}`}>
                      <button
                        className="value-btn"
                        onClick={() => setDetail({ handle: account.handle, metric: "followers" })}
                        title="Follower seit dem ersten Messpunkt"
                      >
                        {formatSigned(account.deltaAll)}
                      </button>
                    </td>
                    <td className="right">
                      <button
                        className="value-btn"
                        onClick={() => setDetail({ handle: account.handle, metric: "videos" })}
                        title="Video-Anzahl im Verlauf"
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
                          title="Alle Werte dieses Accounts ansehen"
                        >
                          Werte
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => remove(account.handle)}
                          disabled={busy !== null}
                          title="Aus Watchlist entfernen"
                        >
                          entfernen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Auf jede Zahl klicken, um ihren Verlauf zu öffnen – Follower, Likes, Videos, Folgt-selbst, Engagement-Rate und
            Score. Nach jedem eigenen Upload einmal „Alle messen“ klicken, so entsteht eine echte Kurve.
          </p>
        </Section>
      )}

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
