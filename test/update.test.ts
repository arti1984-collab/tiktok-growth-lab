import assert from "node:assert/strict";
import test from "node:test";
import {
  assetDownloadUrl,
  classifyProbeStatus,
  compareVersions,
  releaseHeaders,
} from "../server/lib/update.ts";

test("Versionen werden als Zahlen verglichen", () => {
  assert.equal(compareVersions("2.11.0", "2.10.0"), 1);
  assert.equal(compareVersions("2.9.0", "2.10.0"), -1);
  assert.equal(compareVersions("v2.12.0", "2.12.0"), 0);
  assert.equal(compareVersions("2.12", "2.12.1"), -1);
});

test("ohne Token bleibt die Abfrage anonym", () => {
  const headers = releaseHeaders("");
  assert.equal(headers.authorization, undefined);
  assert.equal(headers.accept, "application/vnd.github+json");
  assert.equal(headers["user-agent"], "TikTok-Growth-Lab");
});

test("mit Token kommt der Bearer-Kopf dazu", () => {
  const headers = releaseHeaders("  abc123  ");
  assert.equal(headers.authorization, "Bearer abc123");
});

test("Token-Pruefung ordnet die Statuscodes richtig ein", () => {
  assert.equal(classifyProbeStatus(200, 4999), "ok");
  assert.equal(classifyProbeStatus(401, 10), "invalid");
  assert.equal(classifyProbeStatus(403, 0), "throttled");
  assert.equal(classifyProbeStatus(403, 42), "forbidden");
  assert.equal(classifyProbeStatus(403, null), "forbidden");
  assert.equal(classifyProbeStatus(404, 42), "missing");
  assert.equal(classifyProbeStatus(429, 0), "throttled");
  assert.equal(classifyProbeStatus(500, 42), "failed");
});

test("privates Repo laedt ueber die Asset-API", () => {
  const asset = { id: 42, browser_download_url: "https://github.com/owner/repo/releases/download/v1/a.exe" };
  assert.equal(
    assetDownloadUrl("owner/repo", asset, "tok"),
    "https://api.github.com/repos/owner/repo/releases/assets/42",
  );
  assert.equal(assetDownloadUrl("owner/repo", asset, ""), asset.browser_download_url);
  assert.equal(assetDownloadUrl("owner/repo", null, "tok"), null);
  assert.equal(
    assetDownloadUrl("owner/repo", { browser_download_url: "https://example.com/a.exe" }, "tok"),
    "https://example.com/a.exe",
  );
});
