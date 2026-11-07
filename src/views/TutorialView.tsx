import { Section } from "../components/ui";
import { useLang, useT } from "../lang";

/** Jeder Text steht als Paar da: erst Deutsch, dann Englisch. */
type Pair = [string, string];
type Point = { label: Pair; text: Pair };
type Chapter = { title: Pair; intro: Pair; points: Point[] };

const CHAPTERS: Chapter[] = [
  {
    title: ["Scan & Analyse", "Scan & analytics"],
    intro: [
      "Holt Profil und die neuesten Videos direkt von tiktok.com. Ohne Login, ohne Cookie.",
      "Fetches the profile and the newest videos straight from tiktok.com. No login, no cookie.",
    ],
    points: [
      {
        label: ["Feld „TikTok-Name oder Profil-Link“", "Field “TikTok name or profile link”"],
        text: [
          "Handle mit @ oder die komplette Profil-URL einfügen, beides wird erkannt. Video-Links kannst du zusätzlich zeilenweise dazugeben, dann werden sie einzeln gelesen.",
          "Paste the handle with @ or the full profile URL, both are recognised. Video links can be added line by line as well, then each one is read separately.",
        ],
      },
      {
        label: ["Scannen", "Scanning"],
        text: [
          "Startet die Abfrage. Profil, Follower und die Videos kommen von TikTok, jede Rechnung passiert danach lokal auf deinem Rechner.",
          "Starts the request. Profile, followers and videos come from TikTok, every calculation runs locally on this computer afterwards.",
        ],
      },
      {
        label: ["Score", "Score"],
        text: [
          "Eine Zahl von 0 bis 100 aus Engagement, Reichweite pro Follower und Posting-Rhythmus. Die Messlatte darunter zeigt, in welchem Bereich du liegst.",
          "A number from 0 to 100 built from engagement, reach per follower and posting rhythm. The gauge underneath shows which range you are in.",
        ],
      },
      {
        label: ["Kennzahlen", "Key numbers"],
        text: [
          "Engagement-Rate, mittlere und durchschnittliche Views, Views pro Follower, Posts pro Woche, Save- und Share-Rate. Jede Kachel nennt den Vergleichswert, an dem du dich messen kannst.",
          "Engagement rate, median and average views, views per follower, posts per week, save and share rate. Every tile names the reference value to measure against.",
        ],
      },
      {
        label: ["Was die Daten sagen", "What the data says"],
        text: [
          "Kurze Sätze, die aus den Zahlen folgen. Sortiert nach Wirkung: erst was gerade bremst, dann was schon trägt.",
          "Short sentences derived from the numbers, ordered by impact: first what holds you back, then what already works.",
        ],
      },
      {
        label: ["Wo es hakt", "Where it breaks down"],
        text: [
          "Direkt unter dem Profil steht nach dem Scan, was gerade bremst: Interaktion, Reichweite, Rhythmus, Ton oder eine dünne Datenbasis. Jeder Punkt nennt die Zahl dahinter, das Problem und unter „Besser machen“, was du konkret änderst. Passt alles, sagt die Karte das ausdrücklich.",
          "Right under the profile after a scan you see what currently holds the account back: interaction, reach, cadence, sound or a thin data base. Each point names the number behind it, the problem and, under “Do this instead”, what to change. When nothing fails, the card says so.",
        ],
      },
      {
        label: ["Beste Zeitfenster", "Best time windows"],
        text: [
          "Wochentag und Stunde, an denen deine bisherigen Videos die meisten Views holen, gerechnet in deiner Zeitzone.",
          "Weekday and hour when your videos so far gathered the most views, calculated in your timezone.",
        ],
      },
      {
        label: ["Videoliste", "Video list"],
        text: [
          "Die neuesten Videos mit Views, Likes, Kommentaren, Shares, Saves, Länge, Sound und Datum. Das Link-Zeichen öffnet das Video bei TikTok.",
          "The newest videos with views, likes, comments, shares, saves, length, sound and date. The link symbol opens the video on TikTok.",
        ],
      },
      {
        label: ["Video-Check", "Video check"],
        text: [
          "Ein einzelnes Video prüfen, auch eines von einem anderen Account: URL einwerfen, „Prüfen“ lesen es aus. Daneben steht dein Median, dein Engagement, das Längenfenster und der beste Slot, damit du siehst, ob das Video über oder unter deinem Schnitt liegt.",
          "Check a single video, including one from another account: paste the URL and “Check” reads it. Next to it sit your median, your engagement, the length window and the best slot, so you can tell whether the video lands above or below your average.",
        ],
      },
      {
        label: ["Wochenbericht", "Weekly report"],
        text: [
          "Der Knopf im Profilfeld öffnet den Bericht: Follower, Score, Engagement, Views je Video, Posts pro Woche, die stärksten Videos und die Hinweise. „Text kopieren“ legt dieselbe Zusammenfassung in die Zwischenablage.",
          "The button in the profile card opens the report: followers, score, engagement, views per video, posts per week, the strongest videos and the notes. “Copy text” puts the same summary on the clipboard.",
        ],
      },
      {
        label: ["Grenze der Methode", "Limit of the method"],
        text: [
          "Ohne Login liefert TikTok höchstens die letzten 15 Videos. Mehr geht nur mit einem Session-Cookie aus den Einstellungen.",
          "Without a login TikTok returns at most the last 15 videos. More needs a session cookie from the settings.",
        ],
      },
    ],
  },
  {
    title: ["Wachstum", "Growth"],
    intro: [
      "Follower-Verlauf für deine eigenen Accounts und für die, die du beobachten willst, dazu Wochenplan und Ziel-Rechner.",
      "Follower history for your own accounts and the ones you want to watch, plus the weekly plan and the goal calculator.",
    ],
    points: [
      {
        label: ["Feld „@account hinzufügen“", "Field “add @account”"],
        text: [
          "Nimmt einen weiteren Account in die Liste auf und setzt gleich den ersten Messpunkt.",
          "Adds another account to the list and sets the first measurement right away.",
        ],
      },
      {
        label: ["Alle messen", "Measure all"],
        text: [
          "Fragt für jeden Account den aktuellen Follower-Stand ab. Jede Messung wird als Punkt gespeichert, auch wenn sich nichts verändert hat.",
          "Asks every account for its current follower count. Each measurement is stored as a point, even when nothing changed.",
        ],
      },
      {
        label: ["Veränderung", "Change"],
        text: [
          "Zeigt das Plus oder Minus der letzten sieben Tage und die Summe seit dem ersten Messpunkt.",
          "Shows the plus or minus of the last seven days and the total since the first measurement.",
        ],
      },
      {
        label: ["Verlauf", "History"],
        text: [
          "Öffnet die Messreihe eines Accounts mit allen gespeicherten Werten, damit du Sprünge und Plateaus siehst.",
          "Opens the measurement series of an account with every stored value, so jumps and plateaus become visible.",
        ],
      },
      {
        label: ["Wochenplan", "Weekly plan"],
        text: [
          "„Termine übernehmen“ legt die drei stärksten Zeitfenster als Termine an. Jeder Termin hat ein Datum, eine Uhrzeit, eine Idee und nach dem Posten die Video-URL, die dann automatisch gegen den Median gemessen wird. Der Zähler oben zeigt offene und gepostete Termine, „+ Termin“ legt einen eigenen an. Sobald drei Termine Zahlen haben, steht darüber die Trefferquote: wie viele über deinem Median lagen, wie viel Median sie im Schnitt erreichten und ob der geplante Slot besser lief als ein verschobener Post. Diese Zahlen liest auch die KI als Beleg, statt nur zu raten.",
          "“Take slots” turns your three strongest time windows into dates. Each slot has a date, a time, an idea and, after posting, the video URL, which is then measured against your median. The counter shows open and posted slots, “+ Slot” adds your own. Once three slots have numbers, the hit rate sits above them: how many landed above your median, how much median they reached on average, and whether the planned slot did better than a moved post. The AI reads those numbers as evidence instead of guessing.",
        ],
      },
      {
        label: ["Ziel-Rechner", "Goal calculator"],
        text: [
          "Zuerst das Profil wählen, dann Ziel-Follower und Datum eintragen. „Ziel speichern“ rechnet: wie viele Follower noch fehlen, wie viele pro Tag und pro Woche nötig sind und wie viele Posts und Views daraus folgen. Jedes Profil hat sein eigenes Ziel, und der Startpunkt bleibt gespeichert: darunter steht, wie viele Follower seit dem Zielstart dazugekommen sind. Grundlage der Post-Zahlen ist dein Schnitt an Views je Video aus dem letzten Scan. Zuklappen geht an zwei Stellen: der Titel der Karte legt die ganze Karte weg, die Zeile mit dem gewählten Account nur die Werte, während Profil, Ziel und Datum stehen bleiben. Ein zweiter Klick holt sie jeweils zurück.",
          "Pick the profile first, then enter target followers and a date. “Save goal” works out how many followers are missing, how many per day and per week that needs, and how many posts and views follow from it. Every profile keeps its own goal, and the starting point stays stored: underneath you see how many followers came in since the goal started. The post numbers are based on your average views per video from the last scan. Two places fold: the card title puts the whole card away, the line with the selected account only the values, while the profile, target and date stay in place. A second click brings them back.",
        ],
      },
      {
        label: ["entfernen", "remove"],
        text: [
          "Nimmt den Account aus der Liste. Die bereits gespeicherten Messungen bleiben in der Datendatei erhalten.",
          "Takes the account off the list. Measurements already stored stay in the data file.",
        ],
      },
    ],
  },
  {
    title: ["KI-Studio", "AI studio"],
    intro: [
      "Schreibt Texte und Strategie auf Basis deiner gescannten Zahlen. Ohne Scan antwortet die KI allgemein.",
      "Writes copy and strategy based on your scanned numbers. Without a scan the AI answers in general terms.",
    ],
    points: [
      {
        label: ["Kontextzeile", "Context line"],
        text: [
          "Sagt dir vor dem Start, ob echte Messdaten vorliegen oder nur die Profilzahlen. Davon hängt ab, wie konkret die Antwort ausfallen kann.",
          "Tells you before you start whether real measurements exist or only profile numbers. That decides how concrete the answer can be.",
        ],
      },
      {
        label: ["Modus-Raster", "Mode grid"],
        text: [
          "Sieben Aufgaben: 30-Tage-Strategie, Profil-Audit, Video-Ideen, Captions, Hooks, 7-Tage-Plan und Hashtags. Der gewählte Modus steht auch auf dem Absendeknopf.",
          "Seven tasks: 30-day strategy, profile audit, video ideas, captions, hooks, 7-day plan and hashtags. The chosen mode also appears on the submit button.",
        ],
      },
      {
        label: ["Thema / konkretes Video", "Topic / specific video"],
        text: [
          "Je genauer die Angabe, desto brauchbarer das Ergebnis. Leer lassen ist erlaubt, dann arbeitet die KI nur mit deinen Zahlen.",
          "The more precise the input, the more useful the answer. Leaving it empty is fine, then the AI works with your numbers only.",
        ],
      },
      {
        label: ["Nische", "Niche"],
        text: [
          "Dein Feld oder Publikum. Im Modus Hashtags ist das die Hauptangabe, weil daraus die Tag-Sets entstehen.",
          "Your field or audience. In hashtag mode this is the main input, because the tag sets are built from it.",
        ],
      },
      {
        label: ["Tonalität und Ziel", "Tone and goal"],
        text: [
          "Bestimmen Wortwahl und Ausrichtung, etwa direkt für Followergewinn oder sachlich für Verkäufe.",
          "They set the wording and direction, for example direct for follower growth or factual for sales.",
        ],
      },
      {
        label: ["Anzahl Ergebnisse", "Number of results"],
        text: [
          "Wie viele Ideen, Hooks oder Captions zurückkommen sollen, zwischen 1 und 20.",
          "How many ideas, hooks or captions should come back, between 1 and 20.",
        ],
      },
      {
        label: ["Ergebnis", "Result"],
        text: [
          "Die Antwort als lesbares JSON mit Feldnamen in der eingestellten Sprache. „Kopieren“ legt den ganzen Block in die Zwischenablage.",
          "The answer as readable JSON with field names in the chosen language. “Copy” puts the whole block on the clipboard.",
        ],
      },
      {
        label: ["Als Textdatei speichern", "Save as text file"],
        text: [
          "Schreibt dieselbe Antwort als .txt mit Überschriften je Block, Umbruch bei 88 Zeichen und Datum im Dateinamen. Auf Android öffnet sich dafür der System-Dialog für den Speicherort.",
          "Writes the same answer as a .txt with a heading per block, line breaks at 88 characters and the date in the file name. On Android the system dialog asks where to save it.",
        ],
      },
    ],
  },
  {
    title: ["Einstellungen", "Settings"],
    intro: [
      "Sprache, KI-Zugang und Scanner. Alles bleibt lokal auf diesem Rechner.",
      "Language, AI access and the scanner. Everything stays local on this computer.",
    ],
    points: [
      {
        label: ["Sprache", "Language"],
        text: [
          "Deutsch oder English. Der Wechsel gilt sofort für alle Tabs, die Anleitung, die Zahlenformate und die Texte der KI. Die Wahl liegt in der Datendatei und bleibt nach einem Neustart.",
          "German or English. The switch applies immediately to every tab, the guide, the number formats and the texts the AI writes. The choice lives in the data file and survives a restart.",
        ],
      },
      {
        label: ["Anbieter-Karten", "Provider cards"],
        text: [
          "Google AI Studio, Groq und OpenRouter. Ein Klick setzt Basis-URL und Modell, den Key trägst du selbst ein.",
          "Google AI Studio, Groq and OpenRouter. One click fills in base URL and model, you add the key yourself.",
        ],
      },
      {
        label: ["Basis-URL", "Base URL"],
        text: ["Jede OpenAI-kompatible Adresse, auch ein eigenes Gateway. Sie endet meist auf /v1.", "Any OpenAI-compatible address, including your own gateway. It usually ends in /v1."],
      },
      {
        label: ["Modell", "Model"],
        text: [
          "Der Modellname beim Anbieter. „Modelle laden“ liest aus, was dein Key tatsächlich darf, und trägt es per Klick ein.",
          "The model name at the provider. “Load models” reads what your key actually allows and fills it in with one click.",
        ],
      },
      {
        label: ["API-Key", "API key"],
        text: [
          "Liegt in der Datendatei und wird nie an den Browser zurückgegeben. Ein gespeicherter Key erscheint nur noch als Maske.",
          "Lives in the data file and is never sent back to the browser. A stored key only appears as a mask.",
        ],
      },
      {
        label: ["Scanner", "Scanner"],
        text: [
          "Pause zwischen zwei TikTok-Anfragen, Zeitzone für die Zeitfenster und optional ein Session-Cookie für mehr als 15 Videos.",
          "Pause between two TikTok requests, timezone for the time windows and optionally a session cookie for more than 15 videos.",
        ],
      },
      {
        label: ["Updates", "Updates"],
        text: [
          "„Nach Updates suchen“ fragt die Releases auf GitHub ab und zeigt, welche Version installiert ist und welche zuletzt erschienen ist. Die Prüfung läuft beim Start und danach alle fünf Minuten von selbst, ohne Einrichtung. Der Hinweis erscheint oben auf jeder Seite. Die App tauscht sich nicht selbst aus.",
          "“Check for updates” asks the releases on GitHub and shows which version is installed and which one came out last. The check runs on start and every five minutes after that, without any setup. The notice appears on top of every page. The app never replaces itself.",
        ],
      },
      {
        label: ["Benachrichtigungen", "Notifications"],
        text: [
          "Erlaubt der Browser Meldungen, dann erinnert die App zwei Stunden vor einem geplanten Termin, zusätzlich zur Leiste auf jeder Seite. Ohne Erlaubnis bleibt die Leiste.",
          "If the browser allows notifications the app reminds you two hours before a planned slot, in addition to the bar on every page. Without permission the bar still shows up.",
        ],
      },
      {
        label: ["Browser-Notausgang", "Browser fallback"],
        text: [
          "Nur in der Desktop-App: Wenn TikTok die Anfrage blockt oder eine Bestätigung verlangt, öffnet sich ein Fenster mit der echten Seite. Du löst das Captcha einmal, danach übernimmt der Scan die Cookies aus diesem Fenster und läuft weiter. In der Web-Version gibt es diesen Weg nicht.",
          "Desktop app only: when TikTok blocks the request or asks for a confirmation, a window with the real page opens. You solve the captcha once, then the scan takes the cookies from that window and keeps going. The web version has no such route.",
        ],
      },
      {
        label: ["Systemstatus", "System status"],
        text: [
          "Version, Speicherort der Daten, Anzahl der Cache-Einträge und ob ein KI-Key gesetzt ist.",
          "Version, where the data lives, how many cache entries exist and whether an AI key is set.",
        ],
      },
    ],
  },
  {
    title: ["Wo die Daten liegen", "Where the data lives"],
    intro: ["Ein Programm ohne Konto und ohne Server dahinter.", "A program without an account and without a server behind it."],
    points: [
      {
        label: ["Web und Desktop", "Web and desktop"],
        text: [
          "data/store.json im Projektordner, in der Desktop-App unter %APPDATA%\\TikTok Growth Lab\\data.",
          "data/store.json in the project folder, in the desktop app under %APPDATA%\\TikTok Growth Lab\\data.",
        ],
      },
      {
        label: ["Android", "Android"],
        text: [
          "Einstellungen und Messreihen liegen im privaten Speicher der App. Ein Export der Rohdaten ist dort nicht eingebaut.",
          "Settings and measurement series live in the private storage of the app. There is no raw data export there.",
        ],
      },
      {
        label: ["Nach außen", "Outward"],
        text: [
          "Nur drei Ziele: tiktok.com beim Scannen, dein KI-Anbieter beim Generieren und die Update-Prüfung an api.github.com. Keine Konten, keine Telemetrie.",
          "Only three destinations: tiktok.com while scanning, your AI provider while generating and the update check on api.github.com. No accounts, no telemetry.",
        ],
      },
    ],
  },
  {
    title: ["Compliance", "Compliance"],
    intro: [
      "Kurz und direkt: alles läuft auf deinem Rechner, gelesen werden nur öffentliche Seiten, die Nutzung liegt bei dir.",
      "Short and direct: everything runs on your machine, only public pages are read, and use is up to you.",
    ],
    points: [
      {
        label: ["Nur lokal", "Local only"],
        text: [
          "Alle Berechnungen laufen lokal. Kein Proxy. Kein eigenes Backend.",
          "All computation runs locally. No proxy. No backend of our own.",
        ],
      },
      {
        label: ["Nur öffentliche Seiten", "Public pages only"],
        text: [
          "Das Tool liest ausschließlich öffentliche TikTok-Webseiten (kein Login erforderlich). Ein Cookie ist optional, bleibt lokal und ändert daran nichts.",
          "The tool reads public TikTok web pages only (no login required). A cookie is optional, stays local and changes none of this.",
        ],
      },
      {
        label: ["Rate limiting", "Rate limiting"],
        text: [
          "Der Scan pausiert zwischen Requests, um Drosselung und Blocks zu vermeiden. Die Pause stellst du unter Einstellungen ein, Standard sind 1200 ms.",
          "The scan pauses between requests to avoid throttling and blocks. You set the pause in the settings, the default is 1200 ms.",
        ],
      },
      {
        label: ["Kein Bulk Export", "No bulk export"],
        text: [
          "Keine Massen-Datensammlung, kein Dump ganzer Profile. Exportiert wird nur die Auswertung, die du selbst angefordert hast.",
          "No mass data collection, no dump of whole profiles. Only the analysis you asked for is exported.",
        ],
      },
      {
        label: ["Nutzerverantwortung", "Your responsibility"],
        text: [
          "Du musst die TikTok-Nutzungsbedingungen einhalten.",
          "You must follow TikTok's Terms of Service.",
        ],
      },
    ],
  },
];

export function TutorialView() {
  const t = useT();
  const lang = useLang();
  const pick = (pair: Pair) => (lang === "en" ? pair[1] : pair[0]);

  return (
    <div className="stack">
      <Section
        title={t("Anleitung", "Guide")}
        subtitle={t("Was jeder Tab tut und wofür die einzelnen Punkte gut sind", "What every tab does and what each control is for")}
      >
        <p className="muted small">
          {t(
            "Reihenfolge für den Anfang: Account scannen, im Tab Wachstum verfolgen, im KI-Studio die passende Aufgabe wählen. Diese Seite erklärt nur, sie ändert nichts.",
            "A good order to start: scan an account, follow it in the growth tab, then pick the fitting task in the AI studio. This page only explains, it changes nothing.",
          )}
        </p>
      </Section>

      {CHAPTERS.map((chapter) => (
        <Section key={pick(chapter.title)} title={pick(chapter.title)} subtitle={pick(chapter.intro)}>
          <dl className="guide-list">
            {chapter.points.map((point) => (
              <div className="guide-row" key={pick(point.label)}>
                <dt>{pick(point.label)}</dt>
                <dd>{pick(point.text)}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ))}
    </div>
  );
}
