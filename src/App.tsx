import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { LangProvider, setActiveLang, type Lang } from "./lang";
import type { AiMode, ScanResult, Status } from "./types";
import { ScanView } from "./views/ScanView";
import { WatchView } from "./views/WatchView";
import { StudioView } from "./views/StudioView";
import { SettingsView } from "./views/SettingsView";
import { TutorialView } from "./views/TutorialView";

type Tab = "scan" | "watch" | "studio" | "settings" | "guide";

const TABS: { id: Tab; de: string; en: string }[] = [
  { id: "scan", de: "Scan & Analyse", en: "Scan & analytics" },
  { id: "watch", de: "Wachstum", en: "Growth" },
  { id: "studio", de: "KI-Studio", en: "AI studio" },
  { id: "settings", de: "Einstellungen", en: "Settings" },
  { id: "guide", de: "Anleitung", en: "Guide" },
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

  const lang: Lang = status?.language === "en" ? "en" : "de";
  // Number formats and file exports read the language outside of React.
  setActiveLang(lang);
  const t = (de: string, en: string) => (lang === "en" ? en : de);

  return (
    <LangProvider lang={lang}>
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
              <p className="muted small">
                {t(
                  "Scraping-Dashboard + KI-Coach für mehr Follower und Reichweite",
                  "Scraping dashboard + AI coach for more followers and reach",
                )}
              </p>
            </div>
          </div>
          <div className="status-row">
            <span className={`pill ${status ? "ok" : "off"}`}>
              {status ? t("TikTok verbunden", "TikTok connected") : t("Server offline", "Server offline")}
            </span>
            <span className={`pill ${status?.ai.configured ? "ok" : "off"}`}>
              {status?.ai.configured ? `KI: ${status.ai.model}` : t("KI: kein Key", "AI: no key")}
            </span>
            <span className="pill">{status?.timezone ?? "–"}</span>
          </div>
        </header>

        <nav className="tabs">
          {TABS.map((entry) => (
            <button key={entry.id} className={`tab ${tab === entry.id ? "active" : ""}`} onClick={() => setTab(entry.id)}>
              {t(entry.de, entry.en)}
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
          {tab === "guide" && <TutorialView />}
        </main>

        <footer className="footer muted small">
          <p>
            {t("Daten kommen direkt von tiktok.com. Lokal gespeichert unter", "Data comes straight from tiktok.com. Stored locally in")}{" "}
            <code>data/store.json</code>{" "}
            {t(
              "– dieser Rechner verlässt nie etwas außer den Anfragen an TikTok und deinen KI-Anbieter.",
              "– nothing leaves this computer except the requests to TikTok and your AI provider.",
            )}
          </p>
          <span className="footer-version">Version {status?.version ?? "–"}</span>
        </footer>
      </div>
    </LangProvider>
  );
}
