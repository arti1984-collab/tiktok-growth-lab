# TikTok Growth Lab

**Deutsch** · [English](#english)

Lokales Programm für TikTok-Wachstum: liest Profil und Video-Performance direkt von tiktok.com, rechnet daraus
Engagement, beste Posting-Zeiten und Ausreißer und lässt eine KI Strategie, Hooks, Captions und einen Wochenplan
daraus schreiben. Alles läuft auf dem eigenen Rechner, ohne Konto und ohne Cloud.

| | |
|---|---|
| Windows | `TikTok-Growth-Lab.exe`, portabel, kein Installer |
| Web | lokaler Server, `npm start`, dann <http://localhost:8787> |
| Sprachen | Deutsch und Englisch, umschaltbar in den Einstellungen |
| Daten | nur lokal in `data/store.json` |

## Was es kann

### Scan und Analyse
Profil und die neuesten 15 Videos werden beim Scan von tiktok.com gelesen: Views, Likes, Kommentare, Shares, Saves,
Länge, Sound, Hashtags und Uhrzeit. Daraus entstehen Engagement-Rate, Views pro Follower, Median, Posting-Rhythmus,
ein Growth-Score von 0 bis 100, die besten Zeitfenster und automatisch formulierte Empfehlungen.

![Scan-Ansicht mit Profilkarte, Video-Check und Kennzahlen](docs/screenshots/scan.png)

### Video-Check
Eine einzelne Video-URL einwerfen und das Video gegen den eigenen Median, das eigene Engagement, die Längenfenster
und die besten Zeiten stellen. Beantwortet die Frage, warum ein Video lief und ein anderes nicht.

### Wochenplan, Ziel-Rechner, Vergleich
Der Scan liefert die starken Zeiten, der Wochenplan macht daraus echte Termine mit Idee, Status und Video-URL. Nach
dem Posten steht die Zahl neben dem Termin. Der Ziel-Rechner sagt, wie viele Follower, Views und Posts pro Woche für
ein Ziel nötig sind. Der Vergleich legt zwei bis drei Accounts aus der Watchlist nebeneinander.

![Wachstumsansicht mit Wochenplan und Ziel-Rechner](docs/screenshots/wachstum.png)

### KI-Studio
Sieben Werkmappen: 30-Tage-Strategie, Profil-Audit, Video-Ideen, Captions, Hooks, 7-Tage-Plan und Hashtags. Die KI
arbeitet mit den gescrapten Zahlen, nicht mit Allgemeinplätzen. Jeder OpenAI-kompatible Anbieter geht, kostenlos
starten Gemini, Groq oder OpenRouter mit eigenem Key.

![KI-Studio mit den sieben Werkmappen](docs/screenshots/studio.png)

Der 7-Tage-Plan liest sich als Ablauf statt als JSON: Tag, Uhrzeit, Thema, Hook, Format, Sound,
Call-to-Action, Aufwand und Hashtags.

![7-Tage-Plan als Wochenplan](docs/screenshots/wochenplan.png)

### Wachstums-Tracking
Accounts in eine Watchlist legen, jeder Scan und jede Messung erzeugt einen Punkt im Verlauf. Sinnvoll, weil TikTok
selbst keine Follower-Historie herausgibt: die Kurve entsteht aus den eigenen Messungen.

### Wochenbericht
Druckbare Ansicht mit den wichtigsten Zahlen, den besten Videos und den Empfehlungen. Der Browser macht daraus ein
PDF.

### Sprache, Updates, Erinnerung
Deutsch und Englisch für Oberfläche, Anleitung, Zahlenformate und KI-Texte. Neue Versionen lädt die Windows-App im
Hintergrund selbst herunter (gegen die GitHub-Releases, ohne Einrichtung), die alte Datei wird beim Beenden ersetzt:
danach genügt ein Neustart. Geplante Posts erscheinen als Leiste und
als Systemmeldung, sobald sie in den nächsten zwei Stunden fällig sind.

![Einstellungen mit Sprache, Updates und KI-Anbieter](docs/screenshots/einstellungen.png)

## Installieren

**Windows:** `TikTok-Growth-Lab.exe` herunterladen, starten, fertig. Portabel, keine Admin-Rechte. Beim ersten Start
auf einem fremden Rechner fragt SmartScreen nach, weil die Datei mit einem lokalen Zertifikat signiert ist.

**Aus dem Quellcode:**

```bash
npm install
npm run dev      # Entwicklung auf http://localhost:8787
npm run build && npm start
npm run dist     # release/TikTok-Growth-Lab.exe
```

## Grenzen

Das Programm liest öffentliche TikTok-Seiten, keine API. Private Konten liefern keine Videos, und TikTok drosselt
häufige Anfragen, deshalb pausiert der Scan zwischen den Aufrufen. Follower-Verläufe entstehen nur aus eigenen
Messungen. Eine laufende Datei lässt sich unter Windows nicht überschreiben, deshalb tauscht die App sie beim
Beenden gegen die heruntergeladene Version.

## Compliance

Kurz und direkt:

Dieses Werkzeug läuft vollständig auf deinem Rechner. Es lädt nur öffentlich zugängliche TikTok-Webseiten (keine
TikTok-API, kein Zugriff auf private Konten). Anfragen werden mit Pausen gedrosselt, damit Drosselung und Sperren
unwahrscheinlich bleiben. Es gehen keine Telemetriedaten an Dritte. Die Nutzung liegt bei dir und muss den
TikTok-Nutzungsbedingungen entsprechen.

- **Nur lokal:** Alle Berechnungen laufen lokal. Kein Proxy. Kein eigenes Backend.
- **Nur öffentliche Seiten:** Das Tool liest ausschließlich öffentliche TikTok-Webseiten (kein Login erforderlich).
  Ein Cookie ist optional, bleibt lokal und ändert daran nichts.
- **Rate limiting:** Der Scan pausiert zwischen Requests (Standard 1200 ms, in den Einstellungen änderbar), um
  Drosselung und Blocks zu vermeiden.
- **Kein Bulk Export:** Keine Massen-Datensammlung, kein Dump ganzer Profile. Exportiert wird nur die Auswertung,
  die du selbst angefordert hast.
- **Nutzerverantwortung:** Du musst die TikTok-Nutzungsbedingungen einhalten.

---

# English

**Local TikTok growth tool:** reads a profile and its video performance straight from tiktok.com, turns that into
engagement, best posting times and outliers, and has an AI write the strategy, hooks, captions and a weekly plan
from it. Everything runs on your own machine, no account, no cloud.

| | |
|---|---|
| Windows | `TikTok-Growth-Lab.exe`, portable, no installer |
| Web | local server, `npm start`, then <http://localhost:8787> |
| Languages | German and English, switchable in the settings |
| Data | local only in `data/store.json` |

## What it does

### Scan and analysis
A scan reads the profile and the newest 15 videos from tiktok.com: views, likes, comments, shares, saves, length,
sound, hashtags and time. From that come the engagement rate, views per follower, median, posting cadence, a growth
score from 0 to 100, the best time windows and automatically written recommendations.

![Scan view with profile card, video check and metrics](docs/screenshots/scan-en.png)

### Video check
Paste a single video URL and compare it with your median, your engagement, your length windows and your best times.
It answers why one video worked and another did not.

### Weekly plan, goal calculator, comparison
The scan finds your strong times, the plan turns them into real slots with an idea, a status and a video URL. Once
posted, the number appears next to the slot. The goal calculator says how many followers, views and posts per week a
target needs. The comparison puts two or three watchlist accounts side by side.

![Growth view with weekly plan and goal calculator](docs/screenshots/wachstum-en.png)

### AI studio
Seven workbooks: 30-day strategy, profile audit, video ideas, captions, hooks, 7-day plan and hashtags. The AI works
from the scraped numbers, not from generic advice. Any OpenAI-compatible provider works, Gemini, Groq and OpenRouter
start free with your own key.

![AI studio with its seven workbooks](docs/screenshots/studio-en.png)

### Growth tracking
Put accounts on a watchlist, every scan and every refresh adds a point to the history. Worth it because TikTok hands
out no follower history: the curve comes from your own measurements.

### Weekly report
A printable view with the key numbers, the best videos and the recommendations. The browser turns it into a PDF.

### Language, updates, reminders
German and English for the interface, the guide, number formats and the AI texts. The Windows app downloads new
versions in the background (against the GitHub releases, no setup needed) and swaps the file on quit, so a restart is
enough. Planned posts show up as a bar and as a system message once they are due within the next two hours.

![Settings with language, updates and AI providers](docs/screenshots/einstellungen-en.png)

## Install

**Windows:** download `TikTok-Growth-Lab.exe`, run it, done. Portable, no admin rights. On another machine SmartScreen
asks once, because the file is signed with a local certificate.

**From source:**

```bash
npm install
npm run dev      # development on http://localhost:8787
npm run build && npm start
npm run dist     # release/TikTok-Growth-Lab.exe
```

## Limits

The tool reads public TikTok pages, not an API. Private accounts return no videos, and TikTok throttles frequent
requests, which is why the scan pauses between calls. Follower histories only come from your own measurements. A
running file cannot be overwritten on Windows, so the app swaps it for the downloaded one on quit.

## Compliance

Short and direct:

This tool runs entirely on your machine. It fetches only publicly accessible TikTok web pages (no TikTok API, no
private account access). Requests are throttled with delays to reduce the chance of blocks. No telemetry is sent to
third parties. Use is at your own responsibility and must comply with TikTok's Terms of Service.

- **Local only:** all computation runs locally. No proxy. No backend of our own.
- **Public pages only:** the tool reads public TikTok web pages only (no login required). A cookie is optional, stays
  local and changes none of this.
- **Rate limiting:** the scan pauses between requests (1200 ms by default, adjustable in the settings) to avoid
  throttling and blocks.
- **No bulk export:** no mass data collection, no dump of whole profiles. Only the analysis you asked for is
  exported.
- **Your responsibility:** you must follow TikTok's Terms of Service.

---

## Projektstruktur / Project layout

```
src/            React-Oberfläche (Web/Desktop)
server/         Express-Server, Scraping, Kennzahlen, KI, Plan, Updates
electron/       Desktop-Hülle
docs/screenshots  Bilder für diese README
release/        gebaute exe
```

## Daten und Datenschutz / Data and privacy

Es gibt keinen Account und keine Telemetrie. Alle Berechnungen laufen lokal, ohne Proxy und ohne eigenes Backend.
Gelesen werden ausschließlich öffentliche TikTok-Webseiten, ein Login ist nicht nötig. Gespeichert werden Profile,
Messpunkte, Plan und Einstellungen in `data/store.json`. Nach außen gehen nur die Anfragen an tiktok.com, an deinen
KI-Anbieter (nur mit hinterlegtem Key) und die Update-Prüfung an api.github.com (mit Token, sonst anonym).

No account, no telemetry. All computation runs locally, with no proxy and no backend of our own. Only public TikTok
web pages are read, no login is required. Profiles, measurements, the plan and the settings live in
`data/store.json`. The only outbound requests go to tiktok.com, to your AI provider (only with a key) and to the
update check on api.github.com (with a token, otherwise anonymous).

## Lizenz / License

Der Quelltext ist öffentlich lesbar, aber nicht frei: Ändern und Weitergeben sind nicht erlaubt, die offiziellen
Dateien aus den Releases darf jede und jeder für sich nutzen. Einzelheiten stehen in [LICENSE](LICENSE). Am Code
ändert allein der Rechteinhaber etwas, fremde Beiträge werden nicht angenommen.

The source is public to read, but not free to reuse: changing and redistributing it are not allowed, while anyone may
use the official files from the releases. Details are in [LICENSE](LICENSE). Only the copyright holder changes the
code, outside contributions are not accepted.
