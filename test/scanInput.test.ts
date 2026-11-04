import assert from "node:assert/strict";
import test from "node:test";
import { MAX_BATCH, normalizeHandleInput, normalizeScanInput } from "../server/lib/scanInput.ts";

test("Handle aus Profil-URL und mit @", () => {
  assert.equal(normalizeHandleInput("https://www.tiktok.com/@TestKonto?lang=de"), "testkonto");
  assert.equal(normalizeHandleInput("  @Arti.1984 "), "arti.1984");
  assert.equal(normalizeHandleInput("testkonto"), "testkonto");
});

test("leere Eingabe bleibt leer", () => {
  assert.equal(normalizeHandleInput("!!!!"), "");
});

test("fremde Links und Unsinn werden abgelehnt", () => {
  const input = normalizeScanInput(
    "@test",
    ["https://youtube.com/watch?v=1", "kein link", "https://www.tiktok.com/@test/video/7300000000000000000?is_copy=1"],
  );
  assert.equal(input.videoUrls.length, 1);
  assert.equal(input.videoUrls[0], "https://www.tiktok.com/@test/video/7300000000000000000");
  assert.equal(input.rejected.length, 2);
});

test("Doppelte Links fallen weg und die Liste ist begrenzt", () => {
  const many = Array.from(
    { length: MAX_BATCH + 5 },
    (_, index) => `https://www.tiktok.com/@a/video/${(7300000000000000000n + BigInt(index)).toString()}`,
  );
  const input = normalizeScanInput("a", [many[0], many[0], ...many]);
  assert.equal(input.videoUrls.length, MAX_BATCH);
});
