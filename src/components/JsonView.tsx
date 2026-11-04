import type { ReactNode } from "react";
import { activeLanguage, useLang, type Lang } from "../lang";

export const LABELS_EN: Record<string, string> = {
  diagnose: "Diagnosis",
  positionierung: "Positioning",
  nische: "Niche",
  zielgruppe: "Audience",
  alleinstellung: "Differentiator",
  profilVersprechen: "Profile promise",
  bioVorschlag: "Bio suggestion",
  contentSaeulen: "Content pillars",
  anteilProzent: "Share",
  warum: "Why",
  beispielThemen: "Example topics",
  hooks: "Hooks",
  text: "Hook",
  typ: "Type",
  zielgruppeHook: "Audience",
  postingPlan: "Posting plan",
  tag: "Day",
  uhrzeit: "Time",
  format: "Format",
  thema: "Topic",
  hook: "Hook",
  hashtagStrategie: "Hashtag strategy",
  reichweite: "Reach",
  marke: "Brand",
  soundStrategie: "Sound strategy",
  seoKeywords: "SEO keywords",
  wachstumshebel: "Growth levers",
  hebel: "Lever",
  schritte: "Steps",
  kpiZiele: "KPI targets",
  followerIn30Tagen: "Followers in 30 days",
  viewsProVideo: "Views per video",
  engagementRateProzent: "Engagement rate",
  warnung: "Warning",
  score: "Score",
  zusammenfassung: "Summary",
  staerken: "Strengths",
  schwaechen: "Weaknesses",
  schnellsteWins: "Quickest wins",
  massnahme: "Action",
  erwarteteWirkung: "Expected effect",
  aufwand: "Effort",
  umsetzungInMinuten: "Implementation (minutes)",
  contentLuecken: "Content gaps",
  risiken: "Risks",
  fazit: "Conclusion",
  ideen: "Ideas",
  titel: "Title",
  drehbuch: "Script",
  sekunde: "Second",
  bild: "Shot",
  cta: "Call to action",
  warumEsFunktioniert: "Why it works",
  hashtags: "Hashtags",
  sound: "Sound",
  schwierigkeit: "Difficulty",
  ziel: "Goal",
  captions: "Captions",
  caption: "Caption",
  onScreenText: "On-screen text",
  begruendung: "Reasoning",
  hinweis: "Note",
  tage: "7-day plan",
  suchbegriffe: "Search terms",
  rohtext: "AI answer",
  usage: "Usage",
};

export const LABELS: Record<string, string> = {
  diagnose: "Diagnose",
  positionierung: "Positionierung",
  nische: "Nische",
  zielgruppe: "Zielgruppe",
  alleinstellung: "Alleinstellung",
  profilVersprechen: "Profil-Versprechen",
  bioVorschlag: "Bio-Vorschlag",
  contentSaeulen: "Content-Säulen",
  anteilProzent: "Anteil",
  warum: "Warum",
  beispielThemen: "Beispiel-Themen",
  hooks: "Hooks",
  text: "Hook",
  typ: "Typ",
  zielgruppeHook: "Zielgruppe",
  postingPlan: "Posting-Plan",
  tag: "Tag",
  uhrzeit: "Uhrzeit",
  format: "Format",
  thema: "Thema",
  hook: "Hook",
  hashtagStrategie: "Hashtag-Strategie",
  reichweite: "Reichweite",
  marke: "Marke",
  soundStrategie: "Sound-Strategie",
  seoKeywords: "SEO-Keywords",
  wachstumshebel: "Wachstumshebel",
  hebel: "Hebel",
  schritte: "Schritte",
  kpiZiele: "KPI-Ziele",
  followerIn30Tagen: "Follower in 30 Tagen",
  viewsProVideo: "Views pro Video",
  engagementRateProzent: "Engagement-Rate",
  warnung: "Warnung",
  score: "Score",
  zusammenfassung: "Zusammenfassung",
  staerken: "Stärken",
  schwaechen: "Schwächen",
  schnellsteWins: "Schnellste Wins",
  massnahme: "Maßnahme",
  erwarteteWirkung: "Erwartete Wirkung",
  aufwand: "Aufwand",
  umsetzungInMinuten: "Umsetzung (Minuten)",
  contentLuecken: "Content-Lücken",
  risiken: "Risiken",
  fazit: "Fazit",
  ideen: "Ideen",
  titel: "Titel",
  drehbuch: "Drehbuch",
  sekunde: "Sekunde",
  bild: "Bild",
  cta: "Call-to-Action",
  warumEsFunktioniert: "Warum es funktioniert",
  hashtags: "Hashtags",
  sound: "Sound",
  schwierigkeit: "Schwierigkeit",
  ziel: "Ziel",
  captions: "Captions",
  caption: "Caption",
  onScreenText: "On-Screen-Text",
  begruendung: "Begründung",
  hinweis: "Hinweis",
  tage: "7-Tage-Plan",
  rohtext: "Antwort der KI",
  usage: "Verbrauch",
};

export const labelFor = (key: string, lang: Lang = activeLanguage()): string => {
  const table = lang === "en" ? LABELS_EN : LABELS;
  if (table[key]) return table[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const label = (key: string) => labelFor(key);

const isPrimitive = (value: unknown) => value === null || ["string", "number", "boolean"].includes(typeof value);

function renderPrimitive(value: unknown): ReactNode {
  if (value === null || value === undefined) return <span className="muted">–</span>;
  if (typeof value === "boolean")
    return <span>{value ? (activeLanguage() === "en" ? "yes" : "ja") : activeLanguage() === "en" ? "no" : "nein"}</span>;
  if (typeof value === "number")
    return <strong className="num">{value.toLocaleString(activeLanguage() === "en" ? "en-US" : "de-DE")}</strong>;
  const text = String(value);
  if (/^https?:\/\//.test(text)) {
    return (
      <a href={text} target="_blank" rel="noreferrer">
        {text.replace(/^https?:\/\//, "").slice(0, 42)}…
      </a>
    );
  }
  return <span>{text}</span>;
}

function renderValue(value: unknown, key: string): ReactNode {
  if (isPrimitive(value)) return <div className="json-value">{renderPrimitive(value)}</div>;

  if (Array.isArray(value)) {
    if (value.every(isPrimitive)) {
      const chips = value.every((entry) => typeof entry === "string" && String(entry).length < 34);
      if (chips) {
        return (
          <div className="chip-row">
            {value.map((entry, index) => (
              <span className="chip" key={`${key}-${index}`}>
                {renderPrimitive(entry)}
              </span>
            ))}
          </div>
        );
      }
      return (
        <ul className="json-list">
          {value.map((entry, index) => (
            <li key={`${key}-${index}`}>{renderPrimitive(entry)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="json-cards">
        {value.map((entry, index) => (
          <article className="json-card" key={`${key}-${index}`}>
            <span className="json-card-index">{String(index + 1).padStart(2, "0")}</span>
            <JsonBody data={entry} />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="json-object">
      <JsonBody data={value} />
    </div>
  );
}

function JsonBody({ data }: { data: unknown }) {
  if (data === null || data === undefined) return <span className="muted">–</span>;
  if (isPrimitive(data)) return <div className="json-value">{renderPrimitive(data)}</div>;
  if (Array.isArray(data)) return <>{renderValue(data, "list")}</>;
  return (
    <div className="json-fields">
      {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
        <div className="json-field" key={key}>
          <span className="json-key">{label(key)}</span>
          {renderValue(value, key)}
        </div>
      ))}
    </div>
  );
}

export function JsonView({ data }: { data: unknown }) {
  // Reading the language here is what makes the labels switch with the setting.
  useLang();
  return (
    <div className="json-view">
      <JsonBody data={data} />
    </div>
  );
}
