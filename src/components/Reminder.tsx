import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useT } from "../lang";
import type { PlanItem } from "../types";

/**
 * Termin-Erinnerung: eine Zeile über dem Inhalt, sobald ein geplanter Post in
 * den nächsten zwei Stunden fällig ist. Zusätzlich eine Systemmeldung, wenn der
 * Browser sie erlaubt hat.
 */

const isSoon = (item: PlanItem): boolean => {
  if (item.status !== "planned") return false;
  const due = new Date(`${item.date}T${item.time}:00`);
  if (Number.isNaN(due.getTime())) return false;
  const diff = due.getTime() - Date.now();
  return diff > -15 * 60_000 && diff < 120 * 60_000;
};

export function Reminder() {
  const t = useT();
  const [due, setDue] = useState<PlanItem[]>([]);
  const [hidden, setHidden] = useState(false);
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const { items } = await api.plan();
        if (!alive) return;
        const soon = items.filter(isSoon);
        setDue(soon);
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        for (const item of soon) {
          const key = `${item.id}:${item.date}:${item.time}`;
          if (shown.current.has(key)) continue;
          shown.current.add(key);
          new Notification(t("TikTok Growth Lab", "TikTok Growth Lab"), {
            body: `${item.time} ${item.note || t("Geplanter Post", "Planned post")}`,
            tag: key,
          });
        }
      } catch {
        // The server may be starting; the next tick tries again.
      }
    }

    void tick();
    const timer = setInterval(() => void tick(), 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (due.length === 0 || hidden) return null;

  return (
    <div className="update-bar reminder-bar">
      <span>
        {due
          .map((item) => `${item.time} ${item.note || t("Geplanter Post", "Planned post")}`)
          .join(" · ")}
        {due.length === 1 ? ` · ${t("steht an", "is due")}` : ` · ${t("stehen an", "are due")}`}
      </span>
      <span className="row gap-sm">
        <button className="btn btn-ghost btn-sm" onClick={() => setHidden(true)} aria-label={t("Erinnerung ausblenden", "Hide the reminder")}>
          ✕
        </button>
      </span>
    </div>
  );
}
