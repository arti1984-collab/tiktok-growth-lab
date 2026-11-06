import { useEffect, useState } from "react";
import { formatCompact, formatNumber, formatPercent, formatSigned } from "../format";
import { useT } from "../lang";
import type { Account } from "../types";
import { Section } from "./ui";

/**
 * Vergleich von zwei bis drei Accounts aus der Watchlist. Alles kommt aus den
 * gespeicherten Messpunkten, es wird nichts zusätzlich gescannt.
 */

export function CompareCard({ accounts }: { accounts: Account[] }) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected((previous) => {
      const stillThere = previous.filter((handle) => accounts.some((account) => account.handle === handle));
      if (stillThere.length > 0) return stillThere;
      return accounts.slice(0, 3).map((account) => account.handle);
    });
  }, [accounts]);

  if (accounts.length < 2) return null;

  const chosen = accounts.filter((account) => selected.includes(account.handle));
  const grower = [...chosen].sort((left, right) => (right.delta7 ?? 0) - (left.delta7 ?? 0))[0] ?? null;

  function toggle(handle: string) {
    setSelected((previous) => {
      if (previous.includes(handle)) return previous.filter((entry) => entry !== handle);
      if (previous.length >= 3) return previous;
      return [...previous, handle];
    });
  }

  return (
    <Section
      title={t("Vergleich", "Comparison")}
      subtitle={t(
        "Zwei bis drei Accounts nebeneinander. Die Zahlen stammen aus den Messpunkten der Watchlist.",
        "Two or three accounts side by side. The numbers come from the watchlist measurements.",
      )}
    >
      <div className="row gap-sm wrap">
        {accounts.map((account) => (
          <button
            key={account.handle}
            className={`chip-btn ${selected.includes(account.handle) ? "chip-btn-active" : ""}`}
            onClick={() => toggle(account.handle)}
            title={t("Auswahl umschalten", "Toggle selection")}
          >
            @{account.handle}
          </button>
        ))}
      </div>

      {chosen.length < 2 ? (
        <p className="muted small">{t("Mindestens zwei Accounts auswählen.", "Pick at least two accounts.")}</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Wert", "Value")}</th>
                  {chosen.map((account) => (
                    <th key={account.handle} className="right">
                      @{account.handle}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: t("Follower", "Followers"),
                    value: (account: Account) => formatNumber(account.latest?.followers ?? null),
                  },
                  {
                    label: t("7 Tage", "7 days"),
                    value: (account: Account) => formatSigned(account.delta7),
                  },
                  {
                    label: t("Gesamt", "Total"),
                    value: (account: Account) => formatSigned(account.deltaAll),
                  },
                  {
                    label: t("Videos", "Videos"),
                    value: (account: Account) => formatCompact(account.latest?.videos ?? null),
                  },
                  {
                    label: t("Engagement", "Engagement"),
                    value: (account: Account) => formatPercent(account.latest?.engagementRate ?? null),
                  },
                  {
                    label: t("Score", "Score"),
                    value: (account: Account) => (account.latest?.score != null ? `${account.latest.score}/100` : "–"),
                  },
                  {
                    label: t("Messpunkte", "Measurements"),
                    value: (account: Account) => formatNumber(account.history.length),
                  },
                ].map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {chosen.map((account) => (
                      <td key={account.handle} className="right">
                        {row.value(account)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {grower && (grower.delta7 ?? 0) !== 0 && (
            <p className="muted small">
              {t(
                `Am schnellsten wächst @${grower.handle} mit ${formatSigned(grower.delta7)} Followern in sieben Tagen.`,
                `@${grower.handle} grows fastest with ${formatSigned(grower.delta7)} followers in seven days.`,
              )}
            </p>
          )}
        </>
      )}
    </Section>
  );
}
