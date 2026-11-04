import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapVideoItem, parseProfileHtml } from "../server/lib/tiktok.ts";
import { assessQuality, gateInstruction, qualityGate } from "../server/lib/quality.ts";

const readFixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const profileHtml = readFixture("profile.html");
const itemList = JSON.parse(readFixture("item-list.json")) as { itemList: Record<string, unknown>[] };

test("Profilseite aus gespeichertem HTML", () => {
  const parsed = parseProfileHtml(profileHtml, "fallback");
  assert.ok(parsed.profile, "Profil sollte erkannt werden");
  assert.equal(parsed.statusCode, 0);
  assert.equal(parsed.profile.handle, "testkonto");
  assert.equal(parsed.profile.nickname, "Arti");
  assert.equal(parsed.profile.region, "DE");
  assert.equal(parsed.profile.followers, 12400);
  assert.equal(parsed.profile.following, 321);
  assert.equal(parsed.profile.confidence?.followers, 1);
});

test("Zahl als String zaehlt, aber mit weniger Sicherheit", () => {
  const parsed = parseProfileHtml(profileHtml, "fallback");
  assert.equal(parsed.profile?.hearts, 9800);
  assert.equal(parsed.profile?.confidence?.hearts, 0.6);
});

test("Seite ohne Daten liefert kein Profil", () => {
  const parsed = parseProfileHtml("<html><body>captcha</body></html>", "x");
  assert.equal(parsed.profile, null);
});

test("Videoliste mit sauberen Zahlen", () => {
  const video = mapVideoItem(itemList.itemList[0], "fallback");
  assert.equal(video.id, "7311111111111111111");
  assert.equal(video.views, 15200);
  assert.equal(video.likes, 980);
  assert.equal(video.durationSec, 21);
  assert.equal(video.hashtags.length, 2);
  assert.equal(video.confidence?.views, 1);
  assert.equal(video.confidence?.createdAt, 1);
  assert.equal(video.url, "https://www.tiktok.com/@testkonto/video/7311111111111111111");
});

test("Videoliste mit Strings und Luecken senkt die Sicherheit", () => {
  const video = mapVideoItem(itemList.itemList[1], "fallback");
  assert.equal(video.views, 1200);
  assert.equal(video.confidence?.views, 0.6);
  assert.equal(video.confidence?.duration, 0.6);
  assert.equal(video.confidence?.likes, 0);
  assert.equal(video.confidence?.hashtags, 0);
  assert.equal(video.confidence?.sound, 0);
  assert.equal(video.author, "fallback");
});

test("Datenlage faellt mit unleserlichen Feldern", () => {
  const profile = parseProfileHtml(profileHtml, "fallback").profile!;
  const good = assessQuality({ profile, videos: [mapVideoItem(itemList.itemList[0], "testkonto")] });
  const bad = assessQuality({ profile, videos: [mapVideoItem(itemList.itemList[1], "testkonto")] });

  assert.ok(good.score > bad.score, `gut ${good.score} sollte ueber schlecht ${bad.score} liegen`);
  assert.ok(bad.score > 0);
  assert.deepEqual(bad.missing.includes("likes"), true);
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
