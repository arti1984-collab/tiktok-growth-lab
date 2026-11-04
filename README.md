# TikTok Growth Lab

Lokales Dashboard für TikTok-Wachstum: liest Profil- und Video-Performance **direkt von tiktok.com**, rechnet daraus
Engagement, beste Posting-Zeiten und Ausreißer und lässt eine KI daraus Strategie, Hooks, Captions und einen Content-Plan
schreiben.

Alles läuft auf deinem Rechner. Es gibt keinen Account, keine Cloud und keine Datenbank außer `data/store.json`.

---

## Schnellstart

```bash
npm install
npm run dev
```

Dann <http://localhost:8787> öffnen.

Für den Produktivmodus (schneller, ohne HMR):

```bash
npm run build
npm start
```

---

## Desktop-App (.exe)

Das Tool läuft auch als eigenständiges Windows-Programm mit eigenem Fenster – ohne Terminal, ohne Browser-Tab.

```bash
npm run desktop   # baut und öffnet die App im Electron-Fenster
npm run dist      # baut release/TikTok-Growth-Lab.exe
```

**Eine portable `.exe` bauen:**

```bash
npm install
npm run dist
```

Ergebnis: `release/TikTok-Growth-Lab.exe` – eine einzelne Datei, die du per Doppelklick startest und beliebig
verschieben kannst (kein Installer, keine Admin-Rechte).

**Windows-Warnung beim Start (SmartScreen):** Eine frische, unsignierte exe aus dem Internet wird angehalten mit
„Der Computer wurde durch Windows geschützt“. Deshalb signiert `npm run dist` die Datei am Ende automatisch über
`scripts/sign-exe.ps1`: Beim ersten Lauf entsteht ein eigenes Code-Signing-Zertifikat, das nur für den angemeldeten
Windows-Benutzer als vertrauenswürdig eingetragen wird. Danach startet die App ohne Rückfrage. Auf einem **anderen**
Rechner ist dieses Zertifikat unbekannt; dort hilft nur ein gekauftes Code-Signing-Zertifikat, nicht die lokale Variante.

Was die Desktop-Version anders macht:

- **Eigenes Fenster** mit Icon, Titel „TikTok Growth Lab" und fester Mindestgröße statt Browser-Tab
- Der lokale Server läuft **im Hintergrund mit** und sucht sich einen freien Port – die App kollidiert nie mit einem
  laufenden `npm run dev`
- Daten liegen unter `%APPDATA%\TikTok Growth Lab\data\store.json` statt im Projektordner; ein Log zum Fehlersuchen
  liegt daneben in `app.log`
- TikTok-Links öffnen im Standardbrowser, nicht in der App
- Nur eine Instanz gleichzeitig; ein zweiter Start holt das vorhandene Fenster nach vorn

---

## Android-App (APK)

Unter `android/` liegt eine eigenständige Android-App: eigenes Scraping, eigene Kennzahlen-Rechnung, eigene KI-Anbindung.
Kein PC nötig, keine Server-Verbindung – alles läuft auf dem Handy.

**Bauen** (Android SDK und JDK 17+ nötig):

```bash
cd android
../.tools/gradle-8.13/bin/gradle assembleRelease
```

Ergebnis: `android/app/build/outputs/apk/release/app-release.apk` (wird nach `release/TikTok-Growth-Lab.apk` kopiert).

**Installieren:** APK aufs Handy kopieren, antippen, „Unbekannte Quellen“ für den Dateimanager erlauben. Die App ist mit
dem eigenen Zertifikat `android/keystore.jks` signiert.

| | |
|---|---|
| Paket | `de.artur.growthlab` |
| Mindestversion | Android 8.0 (API 26) |
| Bereiche | Scan, Wachstum, KI-Studio, Setup |
| Speicherung | nur lokal (SharedPreferences), keine Cloud |
| KI | Gemini, Groq oder OpenRouter mit eigenem Key |

**Wichtig:** `android/keystore.jks` samt Passwörtern (in `android/gradle.properties`) aufbewahren. Nur mit demselben
Zertifikat lässt sich eine neue APK über eine installierte kopieren – ohne sie müsste die App erst deinstalliert werden.

---

## Design

Die Oberfläche heißt intern **Nachtstudio**: warmes Anthrazit (`#141210`), cremefarbene Schrift (`#f3ebdd`) und Gold
(`#d9a94c`) nur dort, wo sich etwas bewegt oder eine Handlung sitzt.

Warum so: das Programm wird abends am Rechner benutzt, oft in längeren Sitzungen. Ein kaltes Weiß oder ein grelles
Schwarz ermüdet, ein warmes Anthrazit nicht. Zahlen tragen die Seite, deshalb stehen Messwerte in einer Serifenschrift
wie in einem Kontobuch und alles andere in der Systemschrift. Flächen sind Haarlinien statt schattiger Karten, der
Radius ist 2 px, es gibt keine Unschärfe und kein Leuchten, damit die Daten der einzige Blickfang bleiben. Desktop und
Android teilen Palette, Kanten und Typo-Hierarchie.

## Was das Tool kann

**1. Scan & Analyse**
- Profil live von TikTok: Follower, Likes gesamt, Videoanzahl, Bio, Avatar, Verifizierung
- Post-Performance der neuesten 15 Videos, automatisch beim Scan: Views, Likes, Kommentare, Shares, **Saves**, Videolänge, Sound, Hashtags, Datum
- Kennzahlen: Engagement-Rate (inkl. Aufschlüsselung), Views pro Follower, Median-Views, Posting-Rhythmus, Growth-Score 0–100
- Beste Zeitfenster (Wochentag + Stunde, umgerechnet in deine Zeitzone)
- Performance nach Videolänge, Hashtag-Nutzung, Hook-Signale (Caption-Länge, Fragen, Emojis, Originalton)
- Top-Videos und Ausreißer im Vergleich zum Median, plus automatisch formulierte Insights

**2. Wachstums-Tracking**
- Accounts (eigene + Wettbewerber) in eine Watchlist legen
- Jeder Scan/„Alle messen“ erzeugt einen Messpunkt → Follower-Kurve, 7-Tage-Delta, Gesamt-Delta
- Sinnvoll, weil TikTok selbst **keine** Follower-Historie herausgibt: die Historie entsteht aus deinen Messungen

**3. KI-Studio**
- 30-Tage-Strategie: Positionierung, Content-Säulen, Posting-Plan, Hashtag-Strategie, KPI-Ziele
- Profil-Audit mit den schnellsten Wins
- Video-Ideen mit Hook und Drehbuch in Sekunden-Abschnitten
- Captions (inkl. On-Screen-Text und Hashtags), Hooks, 7-Tage-Plan
- Die KI bekommt die echten gescrapten Zahlen als Kontext – keine generischen Ratschläge aus dem Nichts

**4. Einstellungen**
- KI-Anbieter (Basis-URL, Modell, Key), Modell-Liste laden
- Anfrage-Abstand für den Scraper, Zeitzone, optional TikTok-Cookies, Cache leeren

---

## KI einrichten

Jede **OpenAI-kompatible** API funktioniert. Entweder in der Oberfläche unter *Einstellungen* eintragen oder in `.env`:

```bash
cp .env.example .env
```

```env
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_API_KEY=sk-...
```

Gängige Anbieter – die ersten drei sind **wirklich kostenlos**:

| Anbieter | Basis-URL | Kostenlose Modelle | Free-Tier | Key holen |
|---|---|---|---|---|
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-2.5-flash` | Tageslimits je Modell, keine Kreditkarte | <https://aistudio.google.com/apikey> |
| **Groq** | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` | 30 Anfragen/Min · 1.000/Tag · 8.000 Token/Min | <https://console.groq.com/keys> |
| **OpenRouter** | `https://openrouter.ai/api/v1` | alle IDs mit `:free`, z. B. `nvidia/nemotron-3.5-lightning:free`, `google/gemma-4-31b-it:free` | 20 Anfragen/Min · 50/Tag (1.000/Tag ab 10 $ Guthaben) | <https://openrouter.ai/keys> |
| **Ollama (lokal)** | `http://localhost:11434/v1` | `qwen3:8b`, `llama3.2`, `gemma3:12b` | kein Key, keine Limits, nur deine Hardware | <https://ollama.com/download> |
| OpenAI / ChatGPT | `https://api.openai.com/v1` | – | **kein kostenloses Kontingent**, nur Pay-as-you-go | <https://platform.openai.com/api-keys> |
| Freebuff | `https://freebuff.com/api/v1/paid` | je nach Guthaben | kostenpflichtig | <https://freebuff.com/account/api> |

**ChatGPT ist im Browser gratis, die API von OpenAI nicht.** Wer kostenlos arbeiten will, nimmt Gemini (beste Qualität),
Groq (am schnellsten) oder OpenRouter (größte Modellauswahl).

In der Oberfläche stehen dieselben Anbieter unter *Einstellungen → Anbieter & kostenlose Modelle* als Karten bereit:
ein Klick auf ein Modell trägt Basis-URL und Modell ein, dann nur noch Key einfügen und speichern.

**Modell aussuchen statt eintippen:** Nach dem Einfügen des Keys lädt *Modelle laden* (oder einfach das Key-Feld verlassen)
die echte Modellliste des Anbieters und zeigt sie als Dropdown – das funktioniert schon **bevor** der Key gespeichert ist.
Bei OpenRouter lässt sich per Häkchen auf die kostenlosen `:free`-Modelle filtern.

Hinweis zum Datenschutz: im Gemini- und OpenRouter-Free-Tier dürfen Inhalte zum Verbessern der Modelle verwendet werden –
keine vertraulichen Kundendaten hineingeben. Ollama verlässt deinen Rechner nie.

Der Key wird nur serverseitig verwendet (er liegt in `data/store.json` bzw. in `.env`) und **nie** an den Browser
zurückgegeben. Über *Einstellungen → Modelle laden* siehst du, welche Modellnamen dein Anbieter akzeptiert.

Ohne Key bleibt der komplette Scraping- und Analyse-Teil nutzbar; nur die KI-Buttons melden dann, dass ein Key fehlt.

---

## Wie die Daten von TikTok kommen

TikTok hat die offenen JSON-Endpunkte (`/api/post/item_list`, `/api/user/detail`, Creative Center) für Fremd-IPs
geschlossen – sie antworten leer oder mit `no permission`. Dieses Tool nutzt deshalb das serverseitig gerenderte JSON,
das TikTok in jede öffentliche Seite einbettet:

| Seite | Ausgelesenes Objekt | Inhalt |
|---|---|---|
| `tiktok.com/@name` | `__UNIVERSAL_DATA_FOR_REHYDRATION__ → webapp.user-detail` | Profil + Follower-/Like-/Video-Zähler |
| `tiktok.com/@name/video/ID` | `webapp.video-detail → itemInfo.itemStruct` | Views, Likes, Kommentare, Shares, Saves, Länge, Sound, Hashtags |
| `tiktok.com/api/creator/item_list/` | JSON mit `itemList` | die neuesten 15 Videos samt Stats, ohne Signatur nutzbar |

**Die Videoliste kommt automatisch:** Nach dem Profil fragt der Scan `api/creator/item_list/` mit der `secUid` ab und
bekommt die neuesten 15 Videos mit allen Zahlen. Die signierte `post/item_list/` der Web-App antwortet ohne `X-Gnarly`
nur mit einem leeren Body und wird deshalb nicht verwendet. Ein Name genügt also für die komplette Auswertung; ältere
Videos lassen sich zusätzlich als Links einfügen, Kurzlinks (`vm.tiktok.com/…`) werden automatisch aufgelöst.

Mehr als 15 Videos pro Anfrage lehnt die API mit `statusCode 10201` ab, deshalb bleibt es bei einer Seite.

Der Scraper ist bewusst höflich: **eine Anfrage gleichzeitig**, mindestens 1,2 s Abstand (einstellbar), 3 Versuche mit
Backoff, 15 Minuten Cache pro URL, Stopp bei `ratelimit triggered`. Bei Blockade: Abstand erhöhen, kurz warten oder
Cookies unter *Einstellungen* hinterlegen (aus den Browser-DevTools: `sessionid=…; tt_csrf_token=…`).

### Grenzen

- **Keine Follower-Historie** von TikTok – nur eigene Messpunkte (Watchlist).
- **Keine Kommentar-/Follower-Listen**, keine DMs, kein Posten, kein Login, keine Umgehung von Captchas.
- Automatisiertes Auslesen widerspricht den TikTok-Nutzungsbedingungen. Das Tool ist für eigene Accounts und
  öffentlich sichtbare Marktforschung gedacht – Frequenz niedrig halten, Nutzung auf eigenes Risiko.

---

## Sicherheit & Sichtbarkeit

Das Dashboard hat **keine Anmeldung** – deshalb ist es bewusst nur lokal erreichbar:

- Der Server lauscht standardmäßig auf `127.0.0.1`. Andere Geräte im WLAN und das Internet bekommen keine Verbindung.
- Zusätzlich prüft jede Anfrage den `Host`-Header. Eine fremde Webseite, die ihre Domain auf `127.0.0.1` zeigt
  (DNS-Rebinding), bekommt `403 – Dieser Server ist nur lokal erreichbar`.
- Der Port ist nach außen dicht: auch ein Router-Portforwarding würde nichts öffnen, weil nichts auf einer
  Netzwerkschnittstelle lauscht. **Trotzdem: nicht ins Internet stellen** – es gibt kein HTTPS und keine Anmeldung.
- Auf derselben Windows-Anmeldung sind auch andere Programme erreichbar, die auf deinem Benutzerkonto laufen.

Anders gewünscht? Dann `HOST` in der `.env` setzen (z. B. `HOST=0.0.0.0` für das ganze Heimnetz) – nur mit Bedacht.

Der KI-Key liegt im Klartext in `data/store.json` (nicht versioniert) und wird nie an den Browser zurückgegeben.
TikTok-Cookies sind optional und erhöhen das Risiko für deinen Account – siehe „Grenzen“.

## Projektstruktur

```
server/
  index.ts            HTTP-API (Express) + Vite/SPA-Auslieferung
  config.ts           .env, Pfade, Port
  lib/tiktok.ts       Scraper: Profil, Video, Kurzlinks, Fehlerklassen
  lib/http.ts         Rate-Limiter, Retries, Cache, höfliches Fetch
  lib/metrics.ts      Kennzahlen, Score, Insights (rein rechnerisch)
  lib/ai.ts           OpenAI-kompatibler Client + JSON-Extraktion
  lib/prompts.ts      Prompt- und Schema-Definitionen je KI-Modus
  lib/store.ts        JSON-Store: Einstellungen, Watchlist, Messpunkte
electron/main.mjs     Desktop-Fenster, Serverstart, freier Port, Log
scripts/make-icon.mjs erzeugt build/icon.ico ohne Bildwerkzeuge
build/server/         gebündelter Server für die Desktop-App (esbuild)
src/
  App.tsx             Shell, Tabs, Status
  views/              ScanView, WatchView, StudioView, SettingsView
  components/         UI-Bausteine, JsonView (KI-Ergebnisse rendern)
  api.ts, types.ts, format.ts, styles.css
data/store.json       lokal erzeugt, nicht versioniert
```

## API

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/status` | KI-Status, Scraper-Konfiguration, Zeitzone |
| `POST` | `/api/scan` | `{ handle, videoUrls[], track }` → Profil, Videos, Metriken |
| `POST` | `/api/ai` | `{ mode, handle?, payload }` → KI-Ergebnis als JSON |
| `GET` | `/api/ai/models` | verfügbare Modelle des Anbieters |
| `POST` | `/api/ai/models` | Modellliste für einen Key, der noch nicht gespeichert ist |
| `GET` | `/api/ai/providers` | kostenlose/kostenpflichtige Anbieter-Presets mit Modellen |
| `GET` | `/api/last-scan` | jüngster Scan (stellt den Kontext nach einem Neuladen wieder her) |
| `GET/POST` | `/api/watchlist` | Watchlist lesen / Account aufnehmen |
| `POST` | `/api/watchlist/refresh` | alle Accounts neu messen |
| `DELETE` | `/api/watchlist/:handle` | Account entfernen |
| `GET/PUT` | `/api/settings` | Einstellungen (Key wird nie zurückgegeben) |
| `POST` | `/api/cache/clear` | Scrape-Cache leeren |

## Probleme

| Symptom | Ursache / Lösung |
|---|---|
| „TikTok drosselt die Anfragen“ | Rate-Limit. 1–2 Minuten warten, Abstand in den Einstellungen erhöhen. |
| „TikTok blockt diese Anfrage (403)“ | IP/Captcha. tiktok.com im Browser öffnen, Captcha lösen, Cookies hinterlegen. |
| Profil ja, aber keine Metriken | TikTok lieferte keine Videoliste (privat, gesperrt oder gedrosselt). Scan später wiederholen oder Video-Links einfügen. |
| KI: „Kein KI-Key hinterlegt“ | Key unter Einstellungen eintragen – kostenlos bei Gemini, Groq oder OpenRouter. |
| KI: 404 / Modell nicht gefunden | Basis-URL prüfen und „Modelle laden“ nutzen – Modellnamen wechseln häufig. |
| KI: 429 | Free-Tier-Limit erreicht (Groq/OpenRouter sind schnell ausgeschöpft). Warten oder Anbieter wechseln. |
| KI: 503 „high demand“ | Der Free-Tier ist überlastet – das Tool wiederholt die Anfrage automatisch zweimal (nach 0,9 s und 2,5 s). Bleibt es dabei: kleineres Modell (Flash-Lite) oder anderen Anbieter wählen. |
| KI: Antwort kein JSON | Anderes Modell wählen; das Tool zeigt dann den Rohtext an. |
