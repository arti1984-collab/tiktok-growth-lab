import type { ReactNode } from "react";

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

const label = (key: string) => {
  if (LABELS[key]) return LABELS[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const isPrimitive = (value: unknown) => value === null || ["string", "number", "boolean"].includes(typeof value);

function renderPrimitive(value: unknown): ReactNode {
  if (value === null || value === undefined) return <span className="muted">–</span>;
  if (typeof value === "boolean") return <span>{value ? "ja" : "nein"}</span>;
  if (typeof value === "number") return <strong className="num">{value.toLocaleString("de-DE")}</strong>;
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
  return (
    <div className="json-view">
      <JsonBody data={data} />
    </div>
  );
}
