import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapVideoItem, parseProfileHtml, parseVideoHtml } from "../server/lib/tiktok.ts";
import { assessQuality, gateInstruction, qualityGate } from "../server/lib/quality.ts";

const readFixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

// Mitschnitte aus einem echten Scan von @tiktok, gekuerzt auf den Datenblock.
const realProfileHtml = readFixture("profile.html");
const realVideoHtml = readFixture("video.html");
const realList = JSON.parse(readFixture("item-list.json")) as { itemList: Record<string, unknown>[] };

// Von Hand gebaute Seite fuer die Faelle, die ein echter Mitschnitt nicht hat.
const messyProfileHtml = readFixture("profile-messy.html");
const messyList = JSON.parse(readFixture("item-list-messy.json")) as { itemList: Record<string, unknown>[] };

const REAL_VIDEO_ID = "7702947070604332319";

test("Profilseite aus echtem Mitschnitt", () => {
  const parsed = parseProfileHtml(realProfileHtml, "fallback");
  assert.ok(parsed.profile, "Profil sollte erkannt werden");
  assert.equal(parsed.statusCode, 0);
  assert.equal(parsed.profile.handle, "tiktok");
  assert.ok(parsed.profile.followers > 0);
  assert.ok(parsed.profile.videos > 0);
  assert.ok(parsed.profile.secUid.length > 10);
  assert.equal(parsed.profile.confidence?.followers, 1);
  assert.equal(parsed.profile.url, "https://www.tiktok.com/@tiktok");
});

test("Videoliste aus echtem Mitschnitt", () => {
  const videos = realList.itemList.map((item) => mapVideoItem(item, "fallback"));
  assert.ok(videos.length >= 1);
  const first = videos[0];
  assert.ok(first.id.length >= 16);
  assert.equal(first.author, "tiktok");
  assert.ok(first.views > 0);
  assert.ok(first.durationSec > 0);
  assert.equal(first.confidence?.views, 1);
  assert.equal(first.url, `https://www.tiktok.com/@tiktok/video/${first.id}`);
});

test("Videoseite aus echtem Mitschnitt", () => {
  const parsed = parseVideoHtml(realVideoHtml, "fallback");
  assert.equal(parsed.found, true);
  assert.ok(parsed.video, "Video sollte erkannt werden");
  assert.equal(parsed.video.id, REAL_VIDEO_ID);
  assert.equal(parsed.video.author, "tiktok");
  assert.ok(parsed.video.views > 0);
  assert.ok(parsed.video.desc.length > 0);
  assert.equal(parsed.video.confidence?.views, 1);
  assert.equal(parsed.video.url, `https://www.tiktok.com/@tiktok/video/${REAL_VIDEO_ID}`);
});

test("Seiten ohne Daten liefern weder Profil noch Video", () => {
  const brokenProfile = parseProfileHtml("<html><body>captcha</body></html>", "x");
  assert.equal(brokenProfile.profile, null);

  const brokenVideo = parseVideoHtml("<html><body>captcha</body></html>", "x");
  assert.equal(brokenVideo.found, false);
  assert.equal(brokenVideo.video, null);
});

test("Zahl als String zaehlt, aber mit weniger Sicherheit", () => {
  const parsed = parseProfileHtml(messyProfileHtml, "fallback");
  assert.equal(parsed.profile?.hearts, 98000);
  assert.equal(parsed.profile?.confidence?.hearts, 0.6);
});

test("synthetische Videoliste senkt die Sicherheit bei Luecken", () => {
  const good = mapVideoItem(messyList.itemList[0], "fallback");
  const bad = mapVideoItem(messyList.itemList[1], "fallback");

  assert.equal(good.views, 15200);
  assert.equal(good.confidence?.views, 1);
  assert.equal(bad.views, 1200);
  assert.equal(bad.confidence?.views, 0.6);
  assert.equal(bad.confidence?.duration, 0.6);
  assert.equal(bad.confidence?.likes, 0);
  assert.equal(bad.confidence?.hashtags, 0);
  assert.equal(bad.confidence?.sound, 0);
  assert.equal(bad.author, "fallback");
});

test("Datenlage faellt mit unleserlichen Feldern", () => {
  const profile = parseProfileHtml(messyProfileHtml, "fallback").profile!;
  const good = assessQuality({ profile, videos: [mapVideoItem(messyList.itemList[0], "arti1984po")] });
  const bad = assessQuality({ profile, videos: [mapVideoItem(messyList.itemList[1], "arti1984po")] });

  assert.ok(good.score > bad.score, `gut ${good.score} sollte ueber schlecht ${bad.score} liegen`);
  assert.ok(bad.score > 0);
  assert.equal(bad.missing.includes("likes"), true);
});

test("echte Daten ergeben eine brauchbare Datenlage", () => {
  const profile = parseProfileHtml(realProfileHtml, "fallback").profile!;
  const videos = realList.itemList.map((item) => mapVideoItem(item, "tiktok"));
  const quality = assessQuality({ profile, videos });
  assert.ok(quality.score >= 0.7, `Score ${quality.score} sollte ueber der Warnschwelle liegen`);
  assert.deepEqual(qualityGate(quality).blocked, []);
});

test("Prompt-Zusatz nennt die Datenlage und fordert UNSICHER", () => {
  assert.equal(gateInstruction({ level: "ok", score: 0.9, blocked: [], warning: "" }), "");
  const thin = gateInstruction({ level: "thin", score: 0.5, blocked: [], warning: "" });
  assert.match(thin, /UNSICHER/);
  assert.match(thin, /50 %/);
  const poor = gateInstruction({ level: "poor", score: 0.2, blocked: ["hooks", "hashtags"], warning: "" });
  assert.match(poor, /UNSICHER/);
  assert.match(poor, /20 %/);
});

test("Qualitaetsstufen sperren Hooks und Hashtags erst bei sehr duennen Daten", () => {
  const full = qualityGate({ score: 0.9, missing: [], fields: [] });
  const thin = qualityGate({ score: 0.5, missing: ["likes"], fields: [] });
  const poor = qualityGate({ score: 0.2, missing: ["likes", "views"], fields: [] });

  assert.equal(full.level, "ok");
  assert.deepEqual(full.blocked, []);
  assert.equal(full.warning, "");
  assert.equal(thin.level, "thin");
  assert.deepEqual(thin.blocked, []);
  assert.ok(thin.warning.length > 0);
  assert.equal(poor.level, "poor");
  assert.deepEqual(poor.blocked, ["hooks", "hashtags"]);
});
