/**
 * Kleine Zaehler fuer den Systemstatus: wie oft gescannt wurde, was schiefging
 * und wie oft TikTok gedrosselt hat. Alles nur im Speicher, kein Versand.
 */

export type Diagnostics = {
  scans: number;
  scansOk: number;
  scansFailed: number;
  lastScanAt: number | null;
  lastScanOk: boolean | null;
  lastErrorCode: string | null;
  lastErrorAt: number | null;
  rateLimited: number;
  aiCalls: number;
  aiParseFailed: number;
  startedAt: number;
};

const counters: Diagnostics = {
  scans: 0,
  scansOk: 0,
  scansFailed: 0,
  lastScanAt: null,
  lastScanOk: null,
  lastErrorCode: null,
  lastErrorAt: null,
  rateLimited: 0,
  aiCalls: 0,
  aiParseFailed: 0,
  startedAt: Date.now(),
};

export function recordScanStart(): void {
  counters.scans += 1;
}

export function recordScan(ok: boolean, errorCode: string | null = null): void {
  counters.lastScanAt = Date.now();
  counters.lastScanOk = ok;
  if (ok) counters.scansOk += 1;
  else counters.scansFailed += 1;
  if (errorCode) {
    counters.lastErrorCode = errorCode;
    counters.lastErrorAt = Date.now();
  }
}

export function recordFailure(code: string): void {
  counters.lastErrorCode = code.slice(0, 120);
  counters.lastErrorAt = Date.now();
}

export function recordRateLimit(): void {
  counters.rateLimited += 1;
}

export function recordAiCall(parseFailed = false): void {
  counters.aiCalls += 1;
  if (parseFailed) counters.aiParseFailed += 1;
}

export function diagnostics(): Diagnostics {
  return { ...counters };
}
