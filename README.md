# TikTok Growth Lab

**Deutsch** · [English](#english)

Lokales Programm für TikTok-Wachstum: liest Profil und Video-Performance direkt von tiktok.com, rechnet daraus
Engagement, beste Posting-Zeiten und Ausreißer und lässt eine KI Strategie, Hooks, Captions und einen Wochenplan
daraus schreiben. Alles läuft auf dem eigenen Rechner oder Handy, ohne Konto und ohne Cloud.

| | |
|---|---|
| Windows | `TikTok-Growth-Lab.exe`, portabel, kein Installer |
| Android | `TikTok-Growth-Lab.apk`, ab Android 8.0 |
| Web | lokaler Server, `npm start`, dann <http://localhost:8787> |
| Sprachen | Deutsch und Englisch, umschaltbar in den Einstellungen |
| Daten | nur lokal: `data/store.json` (Web/Desktop), SharedPreferences (Android) |

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

### Wachstums-Tracking
Accounts in eine Watchlist legen, jeder Scan und jede Messung erzeugt einen Punkt im Verlauf. Sinnvoll, weil TikTok
selbst keine Follower-Historie herausgibt: die Kurve entsteht aus den eigenen Messungen.

### Wochenbericht
Druckbare Ansicht mit den wichtigsten Zahlen, den besten Videos und den Empfehlungen. Der Browser macht daraus ein
PDF, auf Android wird derselbe Bericht als Text geteilt.

### Sprache, Updates, Erinnerung
Deutsch und Englisch für Oberfläche, Anleitung, Zahlenformate und KI-Texte. Ein Hinweis oben meldet neue Versionen
(Prüfung gegen die GitHub-Releases, ohne Einrichtung, beim Start und alle fünf Minuten). Geplante Posts erscheinen als Leiste und
als Systemmeldung, sobald sie in den nächsten zwei Stunden fällig sind.

![Einstellungen mit Sprache, Updates und KI-Anbieter](docs/screenshots/einstellungen.png)

## Installieren

**Windows:** `TikTok-Growth-Lab.exe` herunterladen, starten, fertig. Portabel, keine Admin-Rechte. Beim ersten Start
auf einem fremden Rechner fragt SmartScreen nach, weil die Datei mit einem lokalen Zertifikat signiert ist.

**Android:** APK aufs Handy kopieren, antippen, Installation aus unbekannten Quellen erlauben. Die App ist mit dem
eigenen Zertifikat signiert, ein Update setzt dieselbe Signatur voraus.

**Aus dem Quellcode:**

```bash
npm install
npm run dev      # Entwicklung auf http://localhost:8787
npm run build && npm start
npm run dist     # release/TikTok-Growth-Lab.exe
```

Android bauen (JDK 17 und Android SDK nötig):

```bash
cd android
../.tools/gradle-8.13/bin/gradle assembleRelease
```

## Grenzen

Das Programm liest öffentliche TikTok-Seiten, keine API. Private Konten liefern keine Videos, und TikTok drosselt
häufige Anfragen, deshalb pausiert der Scan zwischen den Aufrufen. Follower-Verläufe entstehen nur aus eigenen
Messungen. Kein stilles Selbst-Update: der Hinweis führt zur Datei.

---

# English

**Local TikTok growth tool:** reads a profile and its video performance straight from tiktok.com, turns that into
engagement, best posting times and outliers, and has an AI write the strategy, hooks, captions and a weekly plan
from it. Everything runs on your own machine or phone, no account, no cloud.

| | |
|---|---|
| Windows | `TikTok-Growth-Lab.exe`, portable, no installer |
| Android | `TikTok-Growth-Lab.apk`, Android 8.0 and up |
| Web | local server, `npm start`, then <http://localhost:8787> |
| Languages | German and English, switchable in the settings |
| Data | local only: `data/store.json` (web/desktop), SharedPreferences (Android) |

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
A printable view with the key numbers, the best videos and the recommendations. The browser turns it into a PDF, on
Android the same report is shared as text.

### Language, updates, reminders
German and English for the interface, the guide, number formats and the AI texts. A bar on top announces new
versions (checked against the GitHub releases, no setup needed, on start and every five minutes). Planned posts show up as a bar
and as a system message once they are due within the next two hours.

![Settings with language, updates and AI providers](docs/screenshots/einstellungen-en.png)

## Install

**Windows:** download `TikTok-Growth-Lab.exe`, run it, done. Portable, no admin rights. On another machine SmartScreen
asks once, because the file is signed with a local certificate.

**Android:** copy the APK to the phone, tap it, allow installing from unknown sources. The app is signed with its own
certificate, so an update needs the same signature.

**From source:**

```bash
npm install
npm run dev      # development on http://localhost:8787
npm run build && npm start
npm run dist     # release/TikTok-Growth-Lab.exe
```

Build the Android app (JDK 17 and the Android SDK required):

```bash
cd android
../.tools/gradle-8.13/bin/gradle assembleRelease
```

## Limits

The tool reads public TikTok pages, not an API. Private accounts return no videos, and TikTok throttles frequent
requests, which is why the scan pauses between calls. Follower histories only come from your own measurements. There
is no silent self-update: the notice leads to the file.

---

## Projektstruktur / Project layout

```
src/            React-Oberfläche (Web/Desktop)
server/         Express-Server, Scraping, Kennzahlen, KI, Plan, Updates
electron/       Desktop-Hülle
android/        eigenständige Android-App (Kotlin, Compose)
docs/screenshots  Bilder für diese README
release/        gebaute exe und apk
```

## Daten und Datenschutz / Data and privacy

Es gibt keinen Account und keine Telemetrie. Gespeichert werden Profile, Messpunkte, Plan und Einstellungen in
`data/store.json` beziehungsweise in den SharedPreferences des Geräts. Nach außen gehen nur die Anfragen an
tiktok.com und, wenn du einen Key hinterlegst, an deinen KI-Anbieter.

No account, no telemetry. Profiles, measurements, the plan and the settings live in `data/store.json` or in the
device's SharedPreferences. The only outbound requests go to tiktok.com and, if you add a key, to your AI provider.
