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

private data class Point(val label: String, val text: String)
private data class Chapter(val title: String, val intro: String, val points: List<Point>)

private val Chapters = listOf(
    Chapter(
        "Scan & Analyse",
        "Holt Profil und die neuesten Videos direkt von tiktok.com. Ohne Login, ohne Cookie.",
        listOf(
            Point(
                "Feld TikTok-Name oder Profil-Link",
                "Handle mit @ oder die komplette Profil-URL einfügen. Video-Links kannst du zusätzlich zeilenweise dazugeben.",
            ),
            Point(
                "Scannen",
                "Startet die Abfrage. Profil und Videos kommen von TikTok, jede Rechnung passiert danach auf dem Handy.",
            ),
            Point(
                "Score",
                "Eine Zahl von 0 bis 100 aus Engagement, Reichweite pro Follower und Posting-Rhythmus, mit Messlatte darunter.",
            ),
            Point(
                "Kennzahlen",
                "Engagement-Rate, mittlere und durchschnittliche Views, Views pro Follower, Posts pro Woche, Save- und Share-Rate.",
            ),
            Point(
                "Was die Zahlen bedeuten",
                "Kurze Sätze aus den Messwerten. Erst was bremst, dann was schon trägt.",
            ),
            Point(
                "Beste Zeitfenster",
                "Wochentag und Stunde mit den meisten Views, gerechnet in deiner Zeitzone.",
            ),
            Point(
                "Top-Videos",
                "Die stärksten Videos mit Views, Likes, Kommentaren, Shares und Saves. Antippen öffnet das Video bei TikTok.",
            ),
            Point(
                "Grenze der Methode",
                "Ohne Login liefert TikTok höchstens die letzten 15 Videos. Mehr geht nur mit Session-Cookie in den Einstellungen.",
            ),
        ),
    ),
    Chapter(
        "Wachstum",
        "Follower-Verlauf für deine Accounts und für die, die du beobachten willst.",
        listOf(
            Point(
                "Feld @account hinzufügen",
                "Nimmt einen Account in die Liste auf und setzt gleich den ersten Messpunkt.",
            ),
            Point(
                "Messen",
                "Fragt für jeden Account den aktuellen Follower-Stand ab. Jede Messung bleibt als Punkt gespeichert.",
            ),
            Point(
                "Veränderung",
                "Zeigt das Plus oder Minus der letzten sieben Tage und die Summe seit dem ersten Messpunkt.",
            ),
            Point(
                "Messungen",
                "Die gespeicherte Reihe eines Accounts, damit Sprünge und Plateaus sichtbar werden.",
            ),
            Point(
                "entfernen",
                "Nimmt den Account aus der Liste. Bereits gespeicherte Messungen bleiben erhalten.",
            ),
        ),
    ),
    Chapter(
        "KI-Studio",
        "Schreibt Texte und Strategie auf Basis deiner gescrapten Zahlen. Ohne Scan antwortet die KI allgemein.",
        listOf(
            Point(
                "Modus-Chips",
                "Sieben Aufgaben: 30-Tage-Strategie, Profil-Audit, Video-Ideen, Captions, Hooks, 7-Tage-Plan und Hashtags.",
            ),
            Point(
                "Nische oder Thema",
                "Je genauer die Angabe, desto brauchbarer das Ergebnis. Leer lassen ist erlaubt, dann zählen nur deine Zahlen.",
            ),
            Point(
                "Ergebnis",
                "Die Antwort als lesbares JSON. Kopieren legt den ganzen Block in die Zwischenablage.",
            ),
            Point(
                "Als Textdatei speichern",
                "Schreibt dieselbe Antwort als .txt mit Überschriften je Block und Umbruch bei 88 Zeichen. Der System-Dialog fragt nach dem Speicherort.",
            ),
            Point(
                "Ohne Key",
                "Ohne API-Key erscheint ein Hinweis. Scannen und Rechnen funktionieren auch ohne Key.",
            ),
        ),
    ),
    Chapter(
        "Setup",
        "KI-Zugang und Daten. Alles bleibt auf dem Gerät.",
        listOf(
            Point(
                "Anbieter",
                "Google AI Studio, Groq und OpenRouter. Antippen setzt Basis-URL und Modell, den Key trägst du selbst ein.",
            ),
            Point(
                "Basis-URL und Modell",
                "Jede OpenAI-kompatible Adresse. Verfügbare Modelle werden geladen und lassen sich per Tipp übernehmen.",
            ),
            Point(
                "API-Key",
                "Liegt im privaten Speicher der App und wird nur an deinen Anbieter geschickt.",
            ),
            Point(
                "Woher die Daten kommen",
                "Profil und Videos von tiktok.com, die Auswertung lokal. Keine Konten, keine Telemetrie.",
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
        ScreenTitle("Anleitung", "Was jeder Tab tut und wofür die einzelnen Punkte gut sind.")

        Chapters.forEach { chapter ->
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
