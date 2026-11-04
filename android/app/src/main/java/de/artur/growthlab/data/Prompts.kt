package de.artur.growthlab.data

import java.text.NumberFormat
import java.util.Locale

/** Builds the same prompts the desktop app sends, grounded in the scanned numbers. */
object Prompts {

    val MODES = listOf(
        "strategy" to "30-Tage-Strategie",
        "audit" to "Profil-Audit",
        "ideas" to "Video-Ideen",
        "caption" to "Captions",
        "hooks" to "Hooks",
        "calendar" to "7-Tage-Plan",
        "hashtags" to "Hashtags",
    )

    private const val SYSTEM = """Du bist ein TikTok-Growth-Stratege für den DACH-Markt.
Du kennst den TikTok-Algorithmus 2026: Watchtime und Retention in den ersten 3 Sekunden zählen am meisten, danach Shares, Saves,
Kommentare und Completion-Rate; Follower-Conversion entsteht über Wiedererkennung, Serienformate und klare Profil-Versprechen.
Regeln:
- Antworte ausschließlich auf Deutsch.
- Antworte ausschließlich mit gültigem JSON, exakt nach dem vorgegebenen Schema. Kein Markdown, keine Erklärungen außerhalb des JSON.
- Arbeite mit den gelieferten, gescrapten Daten. Erfinde keine Zahlen.
- Sei radikal konkret: echte Hooks, echte Uhrzeiten, echte Captions. Keine Floskeln wie "sei authentisch".
- Jeder Tipp muss in einem TikTok-Video umsetzbar sein, ohne Equipment-Käufe."""

    private val SCHEMAS = mapOf(
        "strategy" to """{
  "diagnose": "2-4 Sätze: was den Account aktuell ausbremst, mit Bezug auf die Zahlen",
  "positionierung": { "nische": "", "zielgruppe": "", "alleinstellung": "", "profilVersprechen": "", "bioVorschlag": "" },
  "contentSaeulen": [ { "name": "", "anteilProzent": 0, "warum": "", "beispielThemen": ["", ""] } ],
  "hooks": ["10 fertige Hook-Sätze"],
  "postingPlan": [ { "tag": "Montag", "uhrzeit": "18:30", "format": "", "thema": "", "hook": "" } ],
  "hashtagStrategie": { "nische": [""], "reichweite": [""], "marke": [""] },
  "soundStrategie": ["", ""],
  "seoKeywords": [""],
  "wachstumshebel": [ { "hebel": "", "warum": "", "schritte": ["", ""] } ],
  "kpiZiele": { "followerIn30Tagen": 0, "viewsProVideo": 0, "engagementRateProzent": 0 },
  "warnung": ""
}""",
        "audit" to """{
  "score": 0,
  "zusammenfassung": "3-5 Sätze",
  "staerken": [""],
  "schwaechen": [""],
  "schnellsteWins": [ { "massnahme": "", "erwarteteWirkung": "", "aufwand": "niedrig|mittel|hoch", "umsetzungInMinuten": 0 } ],
  "contentLuecken": [""],
  "risiken": [""],
  "fazit": ""
}""",
        "ideas" to """{
  "ideen": [ {
    "titel": "", "hook": "max. 12 Wörter", "format": "Talking Head|POV|Tutorial|Storytime",
    "drehbuch": [ { "sekunde": "0-3", "bild": "", "text": "" } ],
    "cta": "", "warumEsFunktioniert": "", "hashtags": [""], "sound": "",
    "schwierigkeit": "leicht|mittel|hoch", "ziel": "Reichweite|Follower|Interaktion|Saves"
  } ]
}""",
        "caption" to """{
  "captions": [ { "caption": "", "hashtags": [""], "onScreenText": "", "cta": "", "begruendung": "" } ],
  "hinweis": ""
}""",
        "hooks" to """{
  "hooks": [ { "text": "", "typ": "Frage|Zahl|Provokation|Versprechen|Story|Fehler", "zielgruppe": "", "warum": "" } ],
  "hinweis": ""
}""",
        "calendar" to """{
  "tage": [ { "tag": "Montag", "uhrzeit": "18:30", "thema": "", "hook": "", "format": "", "sound": "", "hashtags": [""], "cta": "", "aufwand": "niedrig|mittel|hoch" } ],
  "hinweis": ""
}""",
        "hashtags" to """{
  "hashtagStrategie": { "nische": [""], "reichweite": [""], "marke": [""] },
  "begruendung": "2-4 Sätze: warum diese Sets zur Nische passen",
  "suchbegriffe": [""],
  "hinweis": ""
}""",
    )

    private fun instruction(mode: String): String = when (mode) {
        "strategy" -> "Erstelle eine vollständige 30-Tage-Wachstumsstrategie. Nutze die echten besten Zeitfenster aus den Metriken. Der Posting-Plan enthält 7 Einträge (eine Woche)."
        "audit" -> "Mache ein schonungsloses Profil-Audit. Bewerte Score 0-100 auf Basis der gelieferten Daten. Nenne die 3 Maßnahmen mit dem besten Wirkung/Aufwand-Verhältnis zuerst."
        "ideas" -> "Entwickle 5 Video-Ideen, die auf den Mustern der besten gescrapten Videos aufbauen. Jede Idee braucht ein Drehbuch in Sekunden-Abschnitten."
        "caption" -> "Schreibe 3 Caption-Varianten. Erste Zeile = Hook, dann 2-4 kurze Zeilen, dann CTA. Genau 5 Hashtags pro Variante."
        "hooks" -> "Schreibe 10 Hooks für die ersten 2 Sekunden. Unterschiedliche Typen, kurz, sprechbar, ohne Clickbait-Lügen."
        "calendar" -> "Erstelle einen 7-Tage-Content-Plan mit konkreten Uhrzeiten (nutze die besten Zeitfenster aus den Metriken, sonst 11:30 / 17:30 / 20:00)."
        "hashtags" -> "Stelle ein Hashtag-Set für die angegebene Nische oder das Thema zusammen: 8 bis 12 Nischen-Tags, 8 bis 12 Reichweiten-Tags und 3 bis 5 Marken-Tags, jeweils mit #, klein geschrieben, ohne Duplikate zwischen den Gruppen. Nimm nur Tags, die es auf TikTok wirklich gibt, gemischt aus deutschsprachigen und internationalen Tags. Liegt ein gescannter Account vor, baue dessen stärkste vorhandene Tags ein und begründe die Auswahl mit den Zahlen."
        else -> ""
    }

    private fun context(scan: ScanResult?): String {
        if (scan == null) {
            return "KEIN GESCRAPTER KONTEXT: Der Nutzer hat noch keinen Scan durchgeführt. Arbeite nur mit den Angaben aus der Anfrage und markiere Annahmen klar."
        }
        val profile = scan.profile
        val metrics = scan.metrics
        val nf = NumberFormat.getIntegerInstance(Locale.GERMANY)
        val lines = mutableListOf<String>()
        lines.add(
            "PROFIL: @${profile.handle} (${profile.nickname}) · ${profile.followers} Follower · ${profile.videos} Videos · ${profile.hearts} Likes gesamt · verifiziert: ${if (profile.verified) "ja" else "nein"}",
        )
        if (profile.bio.isNotBlank()) lines.add("BIO: ${profile.bio.take(200)}")

        if (metrics.hasData) {
            lines.add("METRIKEN aus ${metrics.sampleSize} gescrapten Videos:")
            lines.add("- Growth-Score: ${metrics.score}/100")
            lines.add(
                "- Ø Views ${metrics.avgViews} · Median ${metrics.medianViews} · Views pro Follower ${String.format(Locale.GERMANY, "%.2f", metrics.viewsPerFollower ?: 0.0)}",
            )
            lines.add(
                "- Engagement-Rate ${String.format(Locale.GERMANY, "%.2f", metrics.engagementRate ?: 0.0)} % (Likes ${String.format(Locale.GERMANY, "%.2f", metrics.likeRate)} %, Kommentare ${String.format(Locale.GERMANY, "%.2f", metrics.commentRate)} %, Shares ${String.format(Locale.GERMANY, "%.2f", metrics.shareRate)} %, Saves ${String.format(Locale.GERMANY, "%.2f", metrics.saveRate)} %)",
            )
            metrics.postsPerWeek?.let {
                lines.add(
                    "- Rhythmus ${String.format(Locale.GERMANY, "%.1f", it)} Posts/Woche · letzter Post vor ${(metrics.daysSinceLastPost ?: 0.0).toInt()} Tagen · Ø Videolänge ${metrics.avgDuration}s",
                )
            }
            if (metrics.bestSlots.isNotEmpty()) {
                lines.add(
                    "- Beste Zeitfenster: " + metrics.bestSlots.joinToString(" · ") {
                        "${MetricsEngine.weekdayNames[it.weekday - 1]} ${it.hour}:00 (Ø ${nf.format(it.avgViews)} Views, ${it.posts} Posts)"
                    },
                )
            }
            if (metrics.hashtags.isNotEmpty()) {
                lines.add("- Hashtags: " + metrics.hashtags.take(6).joinToString(", ") { "#${it.tag} (${it.posts}×, Ø ${nf.format(it.avgViews)})" })
            }
            val buckets = metrics.durationBuckets.filter { it.posts > 0 }
            if (buckets.isNotEmpty()) {
                lines.add("- Längen-Performance: " + buckets.joinToString(" · ") { "${it.label}: Ø ${nf.format(it.avgViews)} Views / ${it.posts} Videos" })
            }
            lines.add("- Hook-Signale: Ø ${metrics.avgDescLength} Zeichen Caption, ${String.format(Locale.GERMANY, "%.1f", metrics.avgHashtags)} Hashtags/Video")
        } else {
            lines.add("POST-DATEN: keine (noch keine Video-Links gescannt). Profil-Stats sind live, Post-Performance fehlt.")
        }

        if (scan.videos.isNotEmpty()) {
            lines.add("GESCRAPTE VIDEOS (neueste zuerst):")
            scan.videos.take(10).forEachIndexed { index, video ->
                lines.add(
                    "${index + 1}. \"${video.desc.take(90).ifBlank { "(ohne Caption)" }}\" · ${video.views} Views · ${video.likes} Likes · ${video.comments} Kommentare · ${video.durationSec}s",
                )
            }
        }
        return lines.joinToString("\n")
    }

    fun build(mode: String, topic: String, scan: ScanResult?): Pair<String, String> {
        val user = buildString {
            appendLine(instruction(mode))
            appendLine()
            appendLine("ANGABEN DES NUTZERS:")
            appendLine(if (topic.isBlank()) "Keine weiteren Angaben – leite alles aus dem Kontext ab." else "Konkretes Thema/Video: $topic")
            appendLine()
            appendLine("GESCRAPTE TIKTOK-DATEN:")
            appendLine(context(scan))
            appendLine()
            appendLine("AUSGABE-SCHEMA (nur dieses JSON, keine Kommentare):")
            append(SCHEMAS[mode] ?: "{}")
        }
        return SYSTEM to user
    }
}
