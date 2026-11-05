import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_SAMPLE,
  feedbackBlock,
  outcomesFrom,
  plannedAt,
  summarizePlan,
  videoIdFromUrl,
  type PlanLike,
} from "../server/lib/feedback.ts";

const slot = new Date(2026, 10, 3, 19, 0, 0);
const date = `${slot.getFullYear()}-${String(slot.getMonth() + 1).padStart(2, "0")}-${String(slot.getDate()).padStart(2, "0")}`;

function plan(overrides: Partial<PlanLike> = {}): PlanLike {
  return {
    id: "p1",
    date,
    time: "19:00",
    status: "done",
    videoUrl: "https://www.tiktok.com/@test/video/123456789",
    postedAt: plannedAt({ date, time: "19:00" }) ?? 0,
    actualViews: 0,
    actualLikes: 0,
    ...overrides,
  };
}

const scan = { videos: [], metrics: { medianViews: 1000 } };

test("Video-ID kommt aus Video- und Foto-Links", () => {
  assert.equal(videoIdFromUrl("https://www.tiktok.com/@a/video/123456789"), "123456789");
  assert.equal(videoIdFromUrl("https://www.tiktok.com/@a/photo/987654321"), "987654321");
  assert.equal(videoIdFromUrl(""), null);
});

test("ein Post ohne Zahlen zaehlt nicht mit", () => {
  const feedback = summarizePlan(outcomesFrom([plan()], scan));
  assert.equal(feedback.measured, 0);
  assert.equal(feedback.reliable, false);
  assert.equal(feedbackBlock(feedback), "");
});

test("Zahlen von Hand ergeben den Vergleich zum Median", () => {
  const items = [
    plan({ id: "a", actualViews: 2000 }),
    plan({ id: "b", actualViews: 500 }),
    plan({ id: "c", actualViews: 1500 }),
  ];
  const feedback = summarizePlan(outcomesFrom(items, scan));
  assert.equal(feedback.measured, 3);
  assert.equal(feedback.overMedian, 2);
  assert.equal(feedback.avgMultiple, 1.33);
  assert.equal(feedback.reliable, true);
  assert.match(feedbackBlock(feedback), /2 von 3/);
});

test("verschoben zaehlt nicht als geplanter Termin", () => {
  const items = [
    plan({ id: "a", actualViews: 900, postedAt: (plannedAt({ date, time: "19:00" }) ?? 0) + 6 * 3_600_000 }),
    plan({ id: "b", actualViews: 900 }),
  ];
  const feedback = summarizePlan(outcomesFrom(items, scan));
  assert.equal(feedback.moved.count, 1);
  assert.equal(feedback.onSlot.count, 1);
  assert.equal(feedback.onSlot.avgMultiple, 0.9);
});

test("Videos aus dem Scan springen ein, wenn nichts eingetragen ist", () => {
  const scanned = {
    videos: [{ id: "123456789", views: 3000, likes: 200 }],
    metrics: { medianViews: 1000 },
  };
  const [outcome] = outcomesFrom([plan()], scanned);
  assert.equal(outcome.views, 3000);
  assert.equal(outcome.likes, 200);
  assert.equal(outcome.multiple, 3);
});

test("ohne Median entsteht kein Vergleich", () => {
  const feedback = summarizePlan(
    outcomesFrom([plan({ actualViews: 400 })], { videos: [], metrics: { medianViews: 0 } }),
  );
  assert.equal(feedback.total, 1);
  assert.equal(feedback.measured, 0);
  assert.equal(feedback.avgMultiple, null);
  assert.equal(feedbackBlock(feedback), "");
});

test("ab drei gemessenen Posts wird die Aussage belastbar", () => {
  assert.equal(MIN_SAMPLE, 3);
  const two = summarizePlan(
    outcomesFrom([plan({ id: "a", actualViews: 100 }), plan({ id: "b", actualViews: 200 })], scan),
  );
  assert.equal(two.reliable, false);
  assert.match(feedbackBlock(two), /Zu wenige/);
});
