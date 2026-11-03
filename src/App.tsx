import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AiMode, ScanResult, Status } from "./types";
import { ScanView } from "./views/ScanView";
import { WatchView } from "./views/WatchView";
import { StudioView } from "./views/StudioView";
import { SettingsView } from "./views/SettingsView";

type Tab = "scan" | "watch" | "studio" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "scan", label: "Scan & Analyse" },
  { id: "watch", label: "Wachstum" },
  { id: "studio", label: "KI-Studio" },
  { id: "settings", label: "Einstellungen" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("scan");
  const [status, setStatus] = useState<Status | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [studioMode, setStudioMode] = useState<AiMode>("strategy");

  const refreshStatus = useCallback(() => {
    api
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // A reload starts with an empty scan state, but the server still holds the last scan.
  useEffect(() => {
    api
      .lastScan()
      .then((result) => setScan((current) => current ?? result))
      .catch(() => undefined);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M3 18 L9 12 L13 14.5 L21 5.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="21" cy="5.5" r="2.2" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h1>TikTok Growth Lab</h1>
            <p className="muted small">Scraping-Dashboard + KI-Coach für mehr Follower und Reichweite</p>
          </div>
        </div>
        <div className="status-row">
          <span className={`pill ${status ? "ok" : "off"}`}>{status ? "TikTok verbunden" : "Server offline"}</span>
          <span className={`pill ${status?.ai.configured ? "ok" : "off"}`}>
            {status?.ai.configured ? `KI: ${status.ai.model}` : "KI: kein Key"}
          </span>
          <span className="pill">{status?.timezone ?? "–"}</span>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((entry) => (
          <button key={entry.id} className={`tab ${tab === entry.id ? "active" : ""}`} onClick={() => setTab(entry.id)}>
            {entry.label}
          </button>
        ))}
      </nav>

      <main className="container">
        {tab === "scan" && (
          <ScanView
            scan={scan}
            status={status}
            onScan={(result) => {
              setScan(result);
              refreshStatus();
            }}
            onOpenStudio={(mode) => {
              setStudioMode(mode);
              setTab("studio");
            }}
          />
        )}
        {tab === "watch" && <WatchView />}
        {tab === "studio" && <StudioView scan={scan} status={status} initialMode={studioMode} />}
        {tab === "settings" && <SettingsView status={status} onStatusChange={refreshStatus} />}
      </main>

      <footer className="footer muted small">
        Daten kommen direkt von tiktok.com. Lokal gespeichert unter <code>data/store.json</code> – dieser Rechner verlässt nie
        etwas außer den Anfragen an TikTok und deinen KI-Anbieter.
      </footer>
    </div>
  );
}
