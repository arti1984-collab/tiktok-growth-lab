import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { LangProvider, setActiveLang, type Lang } from "./lang";
import type { AiMode, ScanResult, Status, UpdateInfo } from "./types";
import { ScanView } from "./views/ScanView";
import { WatchView } from "./views/WatchView";
import { StudioView } from "./views/StudioView";
import { SettingsView } from "./views/SettingsView";
import { TutorialView } from "./views/TutorialView";
import { Reminder } from "./components/Reminder";

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
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
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

  // No token, no setup: the check runs on start and every five minutes, so a
  // fresh release shows up while the app stays open. While the new file is
  // downloading, the page asks more often to show the progress.
  const updateAvailable = update?.updateAvailable ?? false;
  useEffect(() => {
    let active = true;
    const load = () => {
      api
        .update()
        .then((info) => {
          if (active) setUpdate(info);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, updateAvailable ? 2_000 : 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [updateAvailable]);

  /** Quits the window; the downloaded file replaces the old one on the way out. */
  async function restart() {
    setRestarting(true);
    try {
      await api.restartUpdate();
    } catch {
      setRestarting(false);
    }
  }

  // A reload starts with an empty scan state, but the server still holds the last scan.
  useEffect(() => {
    api
      .lastScan()
      .then((result) => setScan((current) => current ?? result))
      .catch(() => undefined);
  }, []);

  const download = update?.download ?? null;
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

        {update?.updateAvailable && update.latest !== dismissedVersion && (
          <div className="update-bar">
            <span>
              {download?.state === "downloading"
                ? t(
                    `Version ${update.latest} wird im Hintergrund geladen, ${download.percent} %.`,
                    `Version ${update.latest} is downloading in the background, ${download.percent} %.`,
                  )
                : download?.state === "ready"
                  ? t(
                      `Version ${update.latest} liegt bereit. Ein Neustart genügt.`,
                      `Version ${update.latest} is ready. A restart is enough.`,
                    )
                  : download?.state === "failed"
                    ? t(
                        `Version ${update.latest} ist da, der Download ist fehlgeschlagen.`,
                        `Version ${update.latest} is out, the download failed.`,
                      )
                    : t(
                        `Version ${update.latest} ist verfügbar, du nutzt ${update.current}.`,
                        `Version ${update.latest} is available, you are on ${update.current}.`,
                      )}
            </span>
            <span className="row gap-sm">
              {download?.state === "ready" ? (
                <button className="btn btn-sm btn-primary" onClick={() => void restart()} disabled={restarting}>
                  {restarting ? t("Startet neu…", "Restarting…") : t("Jetzt neu starten", "Restart now")}
                </button>
              ) : (
                download?.state !== "downloading" && (
                  <a
                    className="btn btn-sm btn-primary"
                    href={update.exe ?? update.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Herunterladen", "Download")}
                  </a>
                )
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setDismissedVersion(update.latest)}
                aria-label={t("Meldung schließen", "Dismiss notice")}
              >
                ✕
              </button>
            </span>
            {download?.state === "downloading" && (
              <span className="update-progress" aria-hidden>
                <span style={{ width: `${download.percent}%` }} />
              </span>
            )}
          </div>
        )}

        <Reminder />

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
          {tab === "watch" && <WatchView scan={scan} />}
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
