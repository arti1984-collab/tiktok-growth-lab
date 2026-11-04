/**
 * Eingaben fuer den Scan: Handle aus einer Profil-URL oder mit @, Video-Links
 * nur von tiktok.com, doppelte Links fallen weg, die Liste ist begrenzt.
 */

export const MAX_BATCH = 40;

export type RejectedInput = { value: string; reason: string };

export type ScanInput = {
  handle: string;
  videoUrls: string[];
  rejected: RejectedInput[];
};

export function normalizeHandleInput(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.|m\.)?tiktok\.com\/@/i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, "")
    .toLowerCase()
    .slice(0, 60);
}

export function normalizeScanInput(handleRaw: string, rawUrls: string[]): ScanInput {
  const handle = normalizeHandleInput(handleRaw);
  const rejected: RejectedInput[] = [];
  const videoUrls: string[] = [];

  for (const entry of rawUrls) {
    const value = String(entry ?? "").trim();
    if (!value) continue;
    if (value.length > 500) {
      rejected.push({ value: value.slice(0, 80), reason: "zu lang" });
      continue;
    }
    if (!/^https?:\/\//i.test(value)) {
      rejected.push({ value, reason: "keine URL" });
      continue;
    }
    if (!/(^|\.)tiktok\.com/i.test(new URL(value).hostname)) {
      rejected.push({ value, reason: "nicht tiktok.com" });
      continue;
    }
    const clean = value.replace(/[?#].*$/, "");
    if (videoUrls.includes(clean)) continue;
    videoUrls.push(clean);
  }

  return { handle, videoUrls: videoUrls.slice(0, MAX_BATCH), rejected };
}
