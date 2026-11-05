/**
 * Ergebnis-Check: was aus den Posts des Wochenplans wirklich geworden ist.
 * Reine Rechnung ohne Netz, damit sie sich ohne TikTok testen laesst.
 *
 * Die Zahlen kommen aus zwei Quellen: von Hand eingetragen oder aus dem
 * letzten Scan ueber die Video-URL. Ohne Median bleibt der Vergleich leer,
 * statt eine Zahl zu erfinden.
 */

import { tr } from "./lang.ts";

/** Ab so vielen gemessenen Posts ist eine Aussage mehr als Zufall. */
export const MIN_SAMPLE = 3;

/** So nah am geplanten Termin zaehlt ein Post als "am Slot". */
const SLOT_WINDOW_MS = 90 * 60_000;

export type PlanLike = {
  id: string;
  date: string;
  time: string;
  status: string;
  videoUrl: string;
  postedAt: number;
  actualViews: number;
  actualLikes: number;
};

export type VideoLike = { id: string; views: number; likes: number };

/** Der letzte Scan: Videoliste und Median als Messlatte. */
export type ScanLike = { videos: VideoLike[]; metrics: { medianViews: number } } | null;

export type PlanOutcome = {
  id: string;
  views: number;
  likes: number;
  /** Views im Verhaeltnis zum Median, 0 wenn kein Median bekannt ist. */
  multiple: number;
  /** true am geplanten Termin, false verschoben, null ohne postedAt. */
  onSlot: boolean | null;
};

export type PlanFeedback = {
  total: number;
  measured: number;
  overMedian: number;
  avgMultiple: number | null;
  onSlot: { count: number; avgMultiple: number | null };
  moved: { count: number; avgMultiple: number | null };
  reliable: boolean;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Video-ID aus einem TikTok-Link, egal ob /video/ oder /photo/. */
export function videoIdFromUrl(url: string): string | null {
  const match = /\/(?:video|photo)\/(\d{6,})/.exec(url.trim());
  return match ? match[1] : null;
}

/** Geplanter Termin als Zeitstempel, null bei kaputtem Datum oder Zeit. */
export function plannedAt(item: Pick<PlanLike, "date" | "time">): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !/^\d{2}:\d{2}$/.test(item.time)) return null;
  const at = new Date(`${item.date}T${item.time}:00`).getTime();
  return Number.isFinite(at) ? at : null;
}

/**
 * Ein Post zaehlt, sobald Zahlen vorliegen. Ohne Median bleibt multiple 0,
 * damit "über dem Median" nicht aus einer fehlenden Messlatte entsteht.
 */
export function outcomesFrom(items: PlanLike[], scan: ScanLike): PlanOutcome[] {
  const median = scan?.metrics.medianViews ?? 0;
  const byId = new Map((scan?.videos ?? []).map((video) => [video.id, video]));
  const outcomes: PlanOutcome[] = [];

  for (const item of items) {
    if (item.status !== "done") continue;
    const id = videoIdFromUrl(item.videoUrl);
    const video = id ? byId.get(id) : undefined;
    const views = item.actualViews > 0 ? item.actualViews : (video?.views ?? 0);
    if (views <= 0) continue;
    const planned = plannedAt(item);
    outcomes.push({
      id: item.id,
      views,
      likes: item.actualLikes > 0 ? item.actualLikes : (video?.likes ?? 0),
      multiple: median > 0 ? round2(views / median) : 0,
      onSlot: planned === null || item.postedAt <= 0 ? null : Math.abs(item.postedAt - planned) <= SLOT_WINDOW_MS,
    });
  }

  return outcomes;
}

export function summarizePlan(outcomes: PlanOutcome[]): PlanFeedback {
  const compared = outcomes.filter((entry) => entry.multiple > 0);
  const onSlot = compared.filter((entry) => entry.onSlot === true);
  const moved = compared.filter((entry) => entry.onSlot === false);

  return {
    total: outcomes.length,
    measured: compared.length,
    overMedian: compared.filter((entry) => entry.multiple > 1).length,
    avgMultiple: average(compared.map((entry) => entry.multiple)),
    onSlot: { count: onSlot.length, avgMultiple: average(onSlot.map((entry) => entry.multiple)) },
    moved: { count: moved.length, avgMultiple: average(moved.map((entry) => entry.multiple)) },
    reliable: compared.length >= MIN_SAMPLE,
  };
}

const times = (value: number | null): string => (value === null ? "–" : `${value.toFixed(2)}x`);

/**
 * Textblock fuer den Systemprompt. Leer, solange nichts gemessen ist: dann
 * soll die KI nichts ueber Ergebnisse behaupten, was niemand geprueft hat.
 */
export function feedbackBlock(feedback: PlanFeedback): string {
  if (feedback.measured === 0) return "";

  const lines: string[] = [
    tr(
      `ERGEBNIS-CHECK (eigene Posts aus dem Wochenplan): ${feedback.overMedian} von ${feedback.measured} lagen über dem Median, im Schnitt ${times(
        feedback.avgMultiple,
      )} Median.`,
      `RESULT CHECK (own posts from the weekly plan): ${feedback.overMedian} of ${feedback.measured} landed above the median, ${times(
        feedback.avgMultiple,
      )} the median on average.`,
    ),
  ];

  if (feedback.onSlot.count > 0 && feedback.moved.count > 0) {
    lines.push(
      tr(
        `Am geplanten Termin: ${feedback.onSlot.count} Posts, ${times(feedback.onSlot.avgMultiple)} Median · verschoben: ${
          feedback.moved.count
        } Posts, ${times(feedback.moved.avgMultiple)} Median.`,
        `On the planned slot: ${feedback.onSlot.count} posts, ${times(feedback.onSlot.avgMultiple)} the median · moved: ${
          feedback.moved.count
        } posts, ${times(feedback.moved.avgMultiple)} the median.`,
      ),
    );
  }

  lines.push(
    feedback.reliable
      ? tr(
          "Nutze das als Beleg: was am geplanten Termin über dem Median lag, darf als Empfehlung bleiben. Was verschoben besser lief, spricht gegen diesen Slot. Erfinde keine weiteren Zahlen dazu.",
          "Use this as evidence: what landed above the median on the planned slot may stay a recommendation. What did better when moved argues against that slot. Do not invent any further numbers.",
        )
      : tr(
          `Zu wenige gemessene Posts (${feedback.measured} von ${MIN_SAMPLE}): noch keine belastbare Aussage. Behandle den Check als Hinweis, nicht als Messung.`,
          `Too few measured posts (${feedback.measured} of ${MIN_SAMPLE}): not reliable yet. Treat the check as a hint, not a measurement.`,
        ),
  );

  return lines.join("\n");
}
