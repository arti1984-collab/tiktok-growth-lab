package de.artur.growthlab.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.artur.growthlab.data.tr

private data class Point(val label: String, val text: String)
private data class Chapter(val title: String, val intro: String, val points: List<Point>)

/** Wird bei jeder Anzeige neu gebaut, damit die Sprache sofort mitwechselt. */
private fun chapters(): List<Chapter> = listOf(
    Chapter(
        tr("Scan & Analyse", "Scan & analytics"),
        tr(
            "Holt Profil und die neuesten Videos direkt von tiktok.com. Ohne Login, ohne Cookie.",
            "Fetches the profile and the newest videos straight from tiktok.com. No login, no cookie.",
        ),
        listOf(
            Point(
                tr("Feld TikTok-Name oder Profil-Link", "Field TikTok name or profile link"),
                tr(
                    "Handle mit @ oder die komplette Profil-URL einfügen. Video-Links kannst du zusätzlich zeilenweise dazugeben.",
                    "Paste the handle with @ or the full profile URL. Video links can be added line by line as well.",
                ),
            ),
            Point(
                tr("Scannen", "Scanning"),
                tr(
                    "Startet die Abfrage. Profil und Videos kommen von TikTok, jede Rechnung passiert danach auf dem Handy.",
                    "Starts the request. Profile and videos come from TikTok, every calculation happens on the phone afterwards.",
                ),
            ),
            Point(
                tr("Score", "Score"),
                tr(
                    "Eine Zahl von 0 bis 100 aus Engagement, Reichweite pro Follower und Posting-Rhythmus, mit Messlatte darunter.",
                    "A number from 0 to 100 built from engagement, reach per follower and posting rhythm, with a gauge underneath.",
                ),
            ),
            Point(
                tr("Kennzahlen", "Key numbers"),
                tr(
                    "Engagement-Rate, mittlere und durchschnittliche Views, Views pro Follower, Posts pro Woche, Save- und Share-Rate.",
                    "Engagement rate, median and average views, views per follower, posts per week, save and share rate.",
                ),
            ),
            Point(
                tr("Was die Zahlen bedeuten", "What the numbers mean"),
                tr(
                    "Kurze Sätze aus den Messwerten. Erst was bremst, dann was schon trägt.",
                    "Short sentences derived from the measurements. First what holds you back, then what already works.",
                ),
            ),
            Point(
                tr("Beste Zeitfenster", "Best time windows"),
                tr(
                    "Wochentag und Stunde mit den meisten Views, gerechnet in deiner Zeitzone.",
                    "Weekday and hour with the most views, calculated in your timezone.",
                ),
            ),
            Point(
                tr("Top-Videos", "Top videos"),
                tr(
                    "Die stärksten Videos mit Views, Likes, Kommentaren, Shares und Saves. Antippen öffnet das Video bei TikTok.",
                    "The strongest videos with views, likes, comments, shares and saves. Tapping opens the video on TikTok.",
                ),
            ),
            Point(
                tr("Video-Check", "Video check"),
                tr(
                    "Ein einzelnes Video prüfen, auch von einem anderen Account: URL einwerfen und prüfen lassen. Daneben steht dein Median, dein Engagement, das Längenfenster und der beste Slot.",
                    "Check a single video, including one from another account: paste the URL and let the app read it. Next to it sit your median, your engagement, the length window and the best slot.",
                ),
            ),
            Point(
                tr("Wochenbericht", "Weekly report"),
                tr(
                    "Follower, Score, Engagement, Views je Video, Posts pro Woche, die stärksten Videos und die Hinweise als Text. Bericht teilen schickt ihn in eine andere App, etwa Notizen oder Mail.",
                    "Followers, score, engagement, views per video, posts per week, the strongest videos and the notes as text. Share report sends it to another app, for example notes or mail.",
                ),
            ),
            Point(
                tr("Grenze der Methode", "Limit of the method"),
                tr(
                    "Ohne Login liefert TikTok höchstens die letzten 15 Videos. Mehr geht nur mit Session-Cookie in den Einstellungen.",
                    "Without a login TikTok returns at most the last 15 videos. More needs a session cookie in the settings.",
                ),
            ),
        ),
    ),
    Chapter(
        tr("Wachstum", "Growth"),
        tr(
            "Follower-Verlauf für deine Accounts und für die, die du beobachten willst.",
            "Follower history for your accounts and for the ones you want to watch.",
        ),
        listOf(
            Point(
                tr("Feld @account hinzufügen", "Field add @account"),
                tr(
                    "Nimmt einen Account in die Liste auf und setzt gleich den ersten Messpunkt.",
                    "Adds an account to the list and sets the first measurement right away.",
                ),
            ),
            Point(
                tr("Messen", "Measure"),
                tr(
                    "Fragt für jeden Account den aktuellen Follower-Stand ab. Jede Messung bleibt als Punkt gespeichert.",
                    "Asks every account for its current follower count. Each measurement is kept as a point.",
                ),
            ),
            Point(
                tr("Veränderung", "Change"),
                tr(
                    "Zeigt das Plus oder Minus der letzten sieben Tage und die Summe seit dem ersten Messpunkt.",
                    "Shows the plus or minus of the last seven days and the total since the first measurement.",
                ),
            ),
            Point(
                tr("Messungen", "Measurements"),
                tr(
                    "Die gespeicherte Reihe eines Accounts, damit Sprünge und Plateaus sichtbar werden.",
                    "The stored series of an account, so jumps and plateaus become visible.",
                ),
            ),
            Point(
                tr("Wochenplan", "Weekly plan"),
                tr(
                    "Zwei Abende oder drei Termine aus den besten Zeiten anlegen. Jeder Termin hat Datum, Uhrzeit und eine Idee, nach dem Posten trägst du die Video-URL ein, die dann gegen den Median gemessen wird.",
                    "Plan two evenings or take three slots from your best times. Each slot has a date, a time and an idea, and after posting you add the video URL, which is then measured against your median.",
                ),
            ),
            Point(
                tr("Ziel-Rechner", "Goal calculator"),
                tr(
                    "Ziel-Follower und Datum eintragen, dann rechnet die App Follower pro Tag und Woche, Views pro Woche und Posts pro Woche aus, auf Basis deiner Views je Video.",
                    "Enter target followers and a date, and the app works out followers per day and week, views per week and posts per week, based on your views per video.",
                ),
            ),
            Point(
                tr("Vergleich", "Comparison"),
                tr(
                    "Zwei bis drei Accounts nebeneinander: Follower, Gesamt-Zuwachs, Videos, Engagement, Score und Anzahl der Messpunkte.",
                    "Two or three accounts side by side: followers, total gain, videos, engagement, score and the number of measurements.",
                ),
            ),
            Point(
                tr("entfernen", "remove"),
                tr(
                    "Nimmt den Account aus der Liste. Bereits gespeicherte Messungen bleiben erhalten.",
                    "Takes the account off the list. Measurements already stored stay where they are.",
                ),
            ),
        ),
    ),
    Chapter(
        tr("KI-Studio", "AI studio"),
        tr(
            "Schreibt Texte und Strategie auf Basis deiner gescrapten Zahlen. Ohne Scan antwortet die KI allgemein.",
            "Writes copy and strategy based on your scraped numbers. Without a scan the AI answers in general terms.",
        ),
        listOf(
            Point(
                tr("Modus-Chips", "Mode chips"),
                tr(
                    "Sieben Aufgaben: 30-Tage-Strategie, Profil-Audit, Video-Ideen, Captions, Hooks, 7-Tage-Plan und Hashtags.",
                    "Seven tasks: 30-day strategy, profile audit, video ideas, captions, hooks, 7-day plan and hashtags.",
                ),
            ),
            Point(
                tr("Nische oder Thema", "Niche or topic"),
                tr(
                    "Je genauer die Angabe, desto brauchbarer das Ergebnis. Leer lassen ist erlaubt, dann zählen nur deine Zahlen.",
                    "The more precise the input, the more useful the answer. Leaving it empty is fine, then only your numbers count.",
                ),
            ),
            Point(
                tr("Ergebnis", "Result"),
                tr(
                    "Die Antwort als lesbares JSON. Kopieren legt den ganzen Block in die Zwischenablage.",
                    "The answer as readable JSON. Copy puts the whole block on the clipboard.",
                ),
            ),
            Point(
                tr("Als Textdatei speichern", "Save as text file"),
                tr(
                    "Schreibt dieselbe Antwort als .txt mit Überschriften je Block und Umbruch bei 88 Zeichen. Der System-Dialog fragt nach dem Speicherort.",
                    "Writes the same answer as a .txt with a heading per block and line breaks at 88 characters. The system dialog asks where to save it.",
                ),
            ),
            Point(
                tr("Ohne Key", "Without a key"),
                tr(
                    "Ohne API-Key erscheint ein Hinweis. Scannen und Rechnen funktionieren auch ohne Key.",
                    "Without an API key a note appears. Scanning and the numbers work without one.",
                ),
            ),
        ),
    ),
    Chapter(
        tr("Setup", "Setup"),
        tr("KI-Zugang und Daten. Alles bleibt auf dem Gerät.", "AI access and data. Everything stays on the device."),
        listOf(
            Point(
                tr("Anbieter", "Providers"),
                tr(
                    "Google AI Studio, Groq und OpenRouter. Antippen setzt Basis-URL und Modell, den Key trägst du selbst ein.",
                    "Google AI Studio, Groq and OpenRouter. Tapping fills in base URL and model, you add the key yourself.",
                ),
            ),
            Point(
                tr("Sprache", "Language"),
                tr(
                    "Deutsch oder English. Die Wahl gilt für alle Tabs, die Anleitung und die Antworten der KI.",
                    "German or English. The choice applies to every tab, the guide and the answers of the AI.",
                ),
            ),
            Point(
                tr("Basis-URL und Modell", "Base URL and model"),
                tr(
                    "Jede OpenAI-kompatible Adresse. Verfügbare Modelle werden geladen und lassen sich per Tipp übernehmen.",
                    "Any OpenAI-compatible address. Available models are loaded and can be taken over with a tap.",
                ),
            ),
            Point(
                tr("API-Key", "API key"),
                tr(
                    "Liegt im privaten Speicher der App und wird nur an deinen Anbieter geschickt.",
                    "Lives in the private storage of the app and only goes to your provider.",
                ),
            ),
            Point(
                tr("Updates", "Updates"),
                tr(
                    "Nach Updates suchen fragt die Releases auf GitHub ab. Für das private Repo braucht es ein Token mit Lesezugriff. Der Hinweis erscheint danach oben in der App, installiert wird nichts von selbst.",
                    "Check for updates asks the releases on GitHub. The private repo needs a read-only token for that. The notice then appears on top of the app, nothing installs itself.",
                ),
            ),
            Point(
                tr("Erinnerungen", "Reminders"),
                tr(
                    "Erlaubt das Handy Meldungen, erinnert die App zwei Stunden vor einem geplanten Termin. Zusätzlich steht die Leiste mit den fälligen Terminen oben in der App.",
                    "If the phone allows notifications the app reminds you two hours before a planned slot. On top of that the bar with due slots stays at the top of the app.",
                ),
            ),
            Point(
                tr("Session-Cookie", "Session cookie"),
                tr(
                    "Optional: ein Cookie aus dem Browser hebt die Grenze von 15 Videos auf und hilft, wenn TikTok eine Bestätigung verlangt. Er bleibt auf dem Handy und geht nur an tiktok.com.",
                    "Optional: a cookie from a browser lifts the 15-video limit and helps when TikTok asks for a confirmation. It stays on the phone and only goes to tiktok.com.",
                ),
            ),
            Point(
                tr("Woher die Daten kommen", "Where the data comes from"),
                tr(
                    "Profil und Videos von tiktok.com, die Auswertung lokal. Keine Konten, keine Telemetrie.",
                    "Profile and videos from tiktok.com, the analysis locally. No accounts, no telemetry.",
                ),
            ),
        ),
    ),
)

@Composable
fun TutorialScreen() {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenTitle(
            tr("Anleitung", "Guide"),
            tr("Was jeder Tab tut und wofür die einzelnen Punkte gut sind.", "What every tab does and what each control is for."),
        )

        chapters().forEach { chapter ->
            CardBox {
                Text(chapter.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = InkColor)
                Text(chapter.intro, fontSize = 12.sp, color = MutedColor, lineHeight = 17.sp)
                chapter.points.forEach { point ->
                    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        Text(point.label, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = InkColor)
                        Text(point.text, fontSize = 12.sp, color = InkSoft, lineHeight = 16.sp)
                    }
                }
            }
        }
    }
}
