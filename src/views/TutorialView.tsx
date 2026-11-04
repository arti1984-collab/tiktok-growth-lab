import { Section } from "../components/ui";

type Point = { label: string; text: string };
type Chapter = { title: string; intro: string; points: Point[] };

const CHAPTERS: Chapter[] = [
  {
    title: "Scan & Analyse",
    intro: "Holt Profil und die neuesten Videos direkt von tiktok.com. Ohne Login, ohne Cookie.",
    points: [
      {
        label: "Feld „TikTok-Name oder Profil-Link“",
        text: "Handle mit @ oder die komplette Profil-URL einfügen, beides wird erkannt. Video-Links kannst du zusätzlich zeilenweise dazugeben, dann werden sie einzeln gelesen.",
      },
      {
        label: "Scannen",
        text: "Startet die Abfrage. Profil, Follower und die Videos kommen von TikTok, jede Rechnung passiert danach lokal auf deinem Rechner.",
      },
      {
        label: "Score",
        text: "Eine Zahl von 0 bis 100 aus Engagement, Reichweite pro Follower und Posting-Rhythmus. Die Messlatte darunter zeigt, in welchem Bereich du liegst.",
      },
      {
        label: "Kennzahlen",
        text: "Engagement-Rate, mittlere und durchschnittliche Views, Views pro Follower, Posts pro Woche, Save- und Share-Rate. Jede Kachel nennt den Vergleichswert, an dem du dich messen kannst.",
      },
      {
        label: "Was die Daten sagen",
        text: "Kurze Sätze, die aus den Zahlen folgen. Sortiert nach Wirkung: erst was gerade bremst, dann was schon trägt.",
      },
      {
        label: "Beste Zeitfenster",
        text: "Wochentag und Stunde, an denen deine bisherigen Videos die meisten Views holen, gerechnet in deiner Zeitzone.",
      },
      {
        label: "Videoliste",
        text: "Die neuesten Videos mit Views, Likes, Kommentaren, Shares, Saves, Länge, Sound und Datum. Das Link-Zeichen öffnet das Video bei TikTok.",
      },
      {
        label: "Grenze der Methode",
        text: "Ohne Login liefert TikTok höchstens die letzten 15 Videos. Mehr geht nur mit einem Session-Cookie aus den Einstellungen.",
      },
    ],
  },
  {
    title: "Wachstum",
    intro: "Follower-Verlauf für deine eigenen Accounts und für die, die du beobachten willst.",
    points: [
      {
        label: "Feld „@account hinzufügen“",
        text: "Nimmt einen weiteren Account in die Liste auf und setzt gleich den ersten Messpunkt.",
      },
      {
        label: "Alle messen",
        text: "Fragt für jeden Account den aktuellen Follower-Stand ab. Jede Messung wird als Punkt gespeichert, auch wenn sich nichts verändert hat.",
      },
      {
        label: "Veränderung",
        text: "Zeigt das Plus oder Minus der letzten sieben Tage und die Summe seit dem ersten Messpunkt.",
      },
      {
        label: "Verlauf",
        text: "Öffnet die Messreihe eines Accounts mit allen gespeicherten Werten, damit du Sprünge und Plateaus siehst.",
      },
      {
        label: "entfernen",
        text: "Nimmt den Account aus der Liste. Die bereits gespeicherten Messungen bleiben in der Datendatei erhalten.",
      },
    ],
  },
  {
    title: "KI-Studio",
    intro: "Schreibt Texte und Strategie auf Basis deiner gescrapten Zahlen. Ohne Scan antwortet die KI allgemein.",
    points: [
      {
        label: "Kontextzeile",
        text: "Sagt dir vor dem Start, ob echte Messdaten vorliegen oder nur die Profilzahlen. Davon hängt ab, wie konkret die Antwort ausfallen kann.",
      },
      {
        label: "Modus-Raster",
        text: "Sieben Aufgaben: 30-Tage-Strategie, Profil-Audit, Video-Ideen, Captions, Hooks, 7-Tage-Plan und Hashtags. Der gewählte Modus steht auch auf dem Absendeknopf.",
      },
      {
        label: "Thema / konkretes Video",
        text: "Je genauer die Angabe, desto brauchbarer das Ergebnis. Leer lassen ist erlaubt, dann arbeitet die KI nur mit deinen Zahlen.",
      },
      {
        label: "Nische",
        text: "Dein Feld oder Publikum. Im Modus Hashtags ist das die Hauptangabe, weil daraus die Tag-Sets entstehen.",
      },
      {
        label: "Tonalität und Ziel",
        text: "Bestimmen Wortwahl und Ausrichtung, etwa direkt für Followergewinn oder sachlich für Verkäufe.",
      },
      {
        label: "Anzahl Ergebnisse",
        text: "Wie viele Ideen, Hooks oder Captions zurückkommen sollen, zwischen 1 und 20.",
      },
      {
        label: "Ergebnis",
        text: "Die Antwort als lesbares JSON mit deutschen Feldnamen. „Kopieren“ legt den ganzen Block in die Zwischenablage.",
      },
      {
        label: "Als Textdatei speichern",
        text: "Schreibt dieselbe Antwort als .txt mit Überschriften je Block, Umbruch bei 88 Zeichen und Datum im Dateinamen. Auf Android öffnet sich dafür der System-Dialog für den Speicherort.",
      },
    ],
  },
  {
    title: "Einstellungen",
    intro: "KI-Zugang und Scraper. Beides bleibt lokal auf diesem Rechner.",
    points: [
      {
        label: "Anbieter-Karten",
        text: "Google AI Studio, Groq und OpenRouter. Ein Klick setzt Basis-URL und Modell, den Key trägst du selbst ein.",
      },
      {
        label: "Basis-URL",
        text: "Jede OpenAI-kompatible Adresse, auch ein eigenes Gateway. Sie endet meist auf /v1.",
      },
      {
        label: "Modell",
        text: "Der Modellname beim Anbieter. „Modelle laden“ liest aus, was dein Key tatsächlich darf, und trägt es per Klick ein.",
      },
      {
        label: "API-Key",
        text: "Liegt in der Datendatei und wird nie an den Browser zurückgegeben. Ein gespeicherter Key erscheint nur noch als Maske.",
      },
      {
        label: "Scraper",
        text: "Pause zwischen zwei TikTok-Anfragen, Zeitzone für die Zeitfenster und optional ein Session-Cookie für mehr als 15 Videos.",
      },
      {
        label: "Systemstatus",
        text: "Version, Speicherort der Daten, Anzahl der Cache-Einträge und ob ein KI-Key gesetzt ist.",
      },
    ],
  },
  {
    title: "Wo die Daten liegen",
    intro: "Ein Programm ohne Konto und ohne Server dahinter.",
    points: [
      {
        label: "Web und Desktop",
        text: "data/store.json im Projektordner, in der Desktop-App unter %APPDATA%\\TikTok Growth Lab\\data.",
      },
      {
        label: "Android",
        text: "Einstellungen und Messreihen liegen im privaten Speicher der App. Ein Export der Rohdaten ist dort nicht eingebaut.",
      },
      {
        label: "Nach außen",
        text: "Nur zwei Ziele: tiktok.com beim Scannen und dein KI-Anbieter beim Generieren. Keine Konten, keine Telemetrie.",
      },
    ],
  },
];

export function TutorialView() {
  return (
    <div className="stack">
      <Section title="Anleitung" subtitle="Was jeder Tab tut und wofür die einzelnen Punkte gut sind">
        <p className="muted small">
          Reihenfolge für den Anfang: Account scannen, im Tab Wachstum verfolgen, im KI-Studio die passende Aufgabe wählen.
          Diese Seite erklärt nur, sie ändert nichts.
        </p>
      </Section>

      {CHAPTERS.map((chapter) => (
        <Section key={chapter.title} title={chapter.title} subtitle={chapter.intro}>
          <dl className="guide-list">
            {chapter.points.map((point) => (
              <div className="guide-row" key={point.label}>
                <dt>{point.label}</dt>
                <dd>{point.text}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ))}
    </div>
  );
}
