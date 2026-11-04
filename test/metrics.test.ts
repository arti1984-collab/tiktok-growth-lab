import assert from "node:assert/strict";
import test from "node:test";
import { computeMetrics } from "../server/lib/metrics.ts";
import type { Profile, Video } from "../server/lib/tiktok.ts";

const profile: Profile = {
  id: "1",
  handle: "test",
  nickname: "Test",
  bio: "",
  avatar: "",
  verified: false,
  privateAccount: false,
  region: "DE",
  secUid: "sec",
  followers: 10_000,
  following: 100,
  hearts: 50_000,
  videos: 20,
  url: "https://www.tiktok.com/@test",
  scrapedAt: 1_760_000_000,
};

const now = Math.floor(Date.now() / 1000);

function video(index: number, views: number): Video {
  return {
    id: String(index),
    url: `https://www.tiktok.com/@test/video/${index}`,
    desc: `Post ${index} #test`,
    createdAt: now - index * 86_400,
    durationSec: 20,
    views,
    likes: Math.round(views * 0.08),
    comments: Math.round(views * 0.01),
    shares: Math.round(views * 0.005),
    saves: Math.round(views * 0.005),
    author: "test",
    authorFollowers: 10_000,
    music: "original sound",
    originalSound: true,
    hashtags: ["test"],
    thumbnail: "",
    isAd: false,
  };
}

test("ohne Videos gibt es keinen Score", () => {
  const metrics = computeMetrics(profile, [], "Europe/Berlin");
  assert.equal(metrics.hasData, false);
  assert.equal(metrics.score, null);
  assert.equal(metrics.sampleSize, 0);
});

test("Videos ohne Views zaehlen nicht als Daten", () => {
  const metrics = computeMetrics(profile, [video(1, 0), video(2, 0)], "Europe/Berlin");
  assert.equal(metrics.hasData, false);
  assert.equal(metrics.score, null);
});

test("starke Daten liegen im Score-Bereich und erklaeren sich", () => {
  const metrics = computeMetrics(
    profile,
    [video(1, 40_000), video(2, 35_000), video(3, 30_000), video(4, 25_000)],
    "Europe/Berlin",
  );
  assert.equal(metrics.hasData, true);
  assert.ok(metrics.score !== null);
  assert.ok(metrics.score >= 0 && metrics.score <= 100, `Score ausserhalb 0..100: ${metrics.score}`);
  assert.ok((metrics.engagementRate ?? 0) > 0);
  assert.ok(metrics.medianViews > 0);
  assert.ok(metrics.topVideos.length > 0);
});

test("schwache Daten bleiben im Bereich und druecken den Score", () => {
  const weak = computeMetrics(profile, [video(1, 5)], "Europe/Berlin");
  const strong = computeMetrics(
    profile,
    [video(1, 40_000), video(2, 35_000), video(3, 30_000), video(4, 25_000)],
    "Europe/Berlin",
  );
  assert.ok(weak.score !== null && strong.score !== null);
  assert.ok(weak.score >= 0 && weak.score <= 100);
  assert.ok(weak.score < strong.score, `schwach ${weak.score} sollte unter stark ${strong.score} liegen`);
});

test("unbekannte Zeitzone kippt nicht", () => {
  const metrics = computeMetrics(profile, [video(1, 1_000), video(2, 2_000)], "Nirgendwo/Zone");
  assert.equal(metrics.hasData, true);
  assert.ok(metrics.bestSlots.length >= 0);
});

test("schwache Daten nennen Schwaechen mit naechstem Schritt", () => {
  const metrics = computeMetrics(profile, [video(1, 5)], "Europe/Berlin");
  assert.ok(metrics.weaknesses.length > 0);
  assert.ok(
    metrics.weaknesses.some((entry) => entry.severity === "high"),
    "mindestens eine dringende Schwaeche erwartet",
  );
  for (const entry of metrics.weaknesses) {
    assert.ok(entry.title.length > 0 && entry.problem.length > 0 && entry.action.length > 0);
  }
  assert.equal(metrics.weaknesses[0].severity, "high", "dringende Punkte stehen oben");
});

test("starke Daten ohne dringende Schwaeche", () => {
  const videos = Array.from({ length: 10 }, (_, index) => video(index + 1, 40_000 - index * 1_000));
  const metrics = computeMetrics(profile, videos, "Europe/Berlin");
  assert.equal(metrics.hasData, true);
  assert.equal(
    metrics.weaknesses.some((entry) => entry.severity === "high"),
    false,
    `unerwartet dringend: ${metrics.weaknesses.map((entry) => entry.key).join(", ")}`,
  );
});

test("ohne Videos gibt es keine Schwaechenliste", () => {
  const metrics = computeMetrics(profile, [], "Europe/Berlin");
  assert.deepEqual(metrics.weaknesses, []);
});
