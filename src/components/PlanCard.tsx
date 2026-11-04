import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { formatCompact, formatNumber, weekdayName } from "../format";
import { useT } from "../lang";
import type { PlanItem, ScanResult } from "../types";
import { Alert, Section, Spinner } from "./ui";

/**
 * Wochenplan: aus den besten Slots des Scans werden echte Termine. Nach dem
 * Posten trägt man die Video-URL ein, dann steht die Zahl neben dem Plan.
 */

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const videoIdFromUrl = (url: string): string | null => {
  const match = /\/video\/(\d{6,})/.exec(url);
  return match ? match[1] : null;
};

/** Wochentag 1 bis 7 (Montag zuerst) auf das nächste passende Datum legen. */
function nextDateFor(weekday: number, from: Date): Date {
  const target = weekday % 7; // 1..7 → 1..6, 0
  const result = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let diff = (target - result.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  result.setDate(result.getDate() + diff);
  return result;
}

export function PlanCard({ scan }: { scan: ScanResult | null }) {
  const t = useT();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .plan()
      .then((data) => setItems(data.items))
      .catch((caught: ApiError) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  const median = scan?.metrics.medianViews ?? 0;
  const slots = scan?.metrics.bestSlots ?? [];

  /** Drei Termine: die stärksten Wochentage, je zu ihrer besten Stunde. */
  const suggestions = useMemo(() => {
    const today = new Date();
    const picked: { weekday: number; hour: number }[] = [];
    for (const slot of slots) {
      if (picked.length >= 3) break;
      if (picked.some((entry) => entry.weekday === slot.weekday)) continue;
      picked.push({ weekday: slot.weekday, hour: slot.hour });
    }
    if (picked.length === 0) {
      return [1, 2].map((offset) => {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        return { date: isoDate(date), time: "19:00" };
      });
    }
    return picked
      .map((slot) => ({
        date: isoDate(nextDateFor(slot.weekday, today)),
        time: `${String(slot.hour).padStart(2, "0")}:00`,
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [slots]);

  async function run(key: string, action: () => Promise<{ items: PlanItem[] }>) {
    setBusy(key);
    setError(null);
    try {
      const data = await action();
      setItems(data.items);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  const open = items.filter((item) => item.status === "planned");
  const done = items.filter((item) => item.status === "done");

  function measured(item: PlanItem): { views: number; multiple: number } | null {
    const id = videoIdFromUrl(item.videoUrl);
    if (!id || !scan) return null;
    const video = scan.videos.find((entry) => entry.id === id);
    if (!video) return null;
    return { views: video.views, multiple: median > 0 ? video.views / median : 0 };
  }

  return (
    <Section
      title={t("Wochenplan", "Weekly plan")}
      subtitle={t(
        done.length > 0
          ? `${open.length} offen, ${done.length} gepostet. Der Vergleich zeigt, ob die Slot-Empfehlung für dich stimmt.`
          : "Termine aus den besten Slots, abhaken und nach dem Posten die Video-URL eintragen.",
        done.length > 0
          ? `${open.length} open, ${done.length} posted. The comparison shows whether the slot advice works for you.`
          : "Slots turned into dates, tick them off and paste the video URL once posted.",
      )}
      actions={
        <>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void run("suggest", () => api.addPlan(suggestions))}
            disabled={busy !== null}
            title={t("Termine aus den besten Zeiten übernehmen", "Take dates from your best times")}
          >
            {busy === "suggest" ? <Spinner label={t("Lege an…", "Adding…")} /> : t(`${suggestions.length} Termine übernehmen`, `Take ${suggestions.length} slots`)}
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              void run("manual", () => api.addPlan([{ date: isoDate(tomorrow), time: "19:00", note: "" }]));
            }}
            disabled={busy !== null}
          >
            {t("+ Termin", "+ Slot")}
          </button>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}
      {loading ? (
        <Spinner label={t("Lade Plan…", "Loading the plan…")} />
      ) : items.length === 0 ? (
        <p className="muted small">
          {slots.length > 0
            ? t(
                "Noch nichts geplant. Der Knopf oben legt die drei stärksten Zeiten als Termine an.",
                "Nothing planned yet. The button above turns your three strongest times into dates.",
              )
            : t(
                "Noch nichts geplant. Ohne Scan nimmt der Plan zwei Abende vor; nach einem Scan kommen die echten besten Zeiten dazu.",
                "Nothing planned yet. Without a scan the plan suggests two evenings; after a scan your real best times are used.",
              )}
        </p>
      ) : (
        <ul className="plan-list">
          {items.map((item) => {
            const result = measured(item);
            const views = item.actualViews > 0 ? item.actualViews : (result?.views ?? null);
            const date = new Date(`${item.date}T${item.time}:00`);
            const weekday = Number.isNaN(date.getTime()) ? "" : weekdayName((date.getDay() + 6) % 7);
            return (
              <li key={item.id} className={`plan-row ${item.status === "done" ? "is-done" : ""}`}>
                <div className="plan-when">
                  <strong>{item.time}</strong>
                  <span className="muted small">
                    {weekday}, {date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
                <div className="plan-body">
                  <input
                    className="inline-input"
                    defaultValue={item.note}
                    placeholder={t("Idee oder Hook für diesen Post", "Idea or hook for this post")}
                    onBlur={(event) => {
                      if (event.target.value === item.note) return;
                      void run(`note-${item.id}`, () => api.updatePlan(item.id, { note: event.target.value }));
                    }}
                  />
                  {item.status === "done" && (
                    <>
                      <input
                        className="inline-input"
                        defaultValue={item.videoUrl}
                        placeholder={t("Video-URL nach dem Posten", "Video URL after posting")}
                        onBlur={(event) => {
                          if (event.target.value === item.videoUrl) return;
                          void run(`url-${item.id}`, () => api.updatePlan(item.id, { videoUrl: event.target.value }));
                        }}
                      />
                      <input
                        className="inline-input"
                        type="number"
                        min={0}
                        defaultValue={item.actualViews > 0 ? item.actualViews : ""}
                        placeholder={t("Views von Hand, wenn der Scan sie noch nicht hat", "views by hand until the scan has them")}
                        onBlur={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value) || Math.round(value) === item.actualViews) return;
                          void run(`views-${item.id}`, () =>
                            api.updatePlan(item.id, { actualViews: Math.max(0, Math.round(value)) }),
                          );
                        }}
                      />
                      <span className="muted small">
                        {views !== null
                          ? t(
                              `${formatNumber(views)} Views, ${formatCompact(median > 0 ? (views / median) * 100 : 0)} % des Medians`,
                              `${formatNumber(views)} views, ${formatCompact(median > 0 ? (views / median) * 100 : 0)}% of the median`,
                            )
                          : t(
                              "Noch keine Zahlen zu diesem Post. Nach dem nächsten Scan oder von Hand oben.",
                              "No numbers for this post yet. After the next scan or by hand above.",
                            )}
                      </span>
                    </>
                  )}
                </div>
                <div className="plan-actions">
                  <button
                    className={`btn btn-sm ${item.status === "done" ? "btn-ghost" : "btn-primary"}`}
                    onClick={() =>
                      void run(`status-${item.id}`, () =>
                        api.updatePlan(
                          item.id,
                          item.status === "done"
                            ? { status: "planned" }
                            : { status: "done", postedAt: item.postedAt > 0 ? item.postedAt : Date.now() },
                        ),
                      )
                    }
                    disabled={busy !== null}
                  >
                    {item.status === "done" ? t("wieder offen", "reopen") : t("gepostet", "posted")}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void run(`delete-${item.id}`, () => api.deletePlan(item.id))}
                    disabled={busy !== null}
                    title={t("Termin löschen", "Delete this slot")}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
