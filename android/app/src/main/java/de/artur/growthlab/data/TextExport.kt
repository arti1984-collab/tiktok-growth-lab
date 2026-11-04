package de.artur.growthlab.data

import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Textdatei statt JSON: Überschriften je Block, zwei Leerzeichen Einzug,
 * Zeilen auf 88 Zeichen umbrochen. Gleiche Form wie in der Desktop-App.
 */
object TextExport {

    private const val WIDTH = 88
    private val HEAD_KEYS = listOf("titel", "name", "hebel", "massnahme", "text", "caption", "tag", "typ")

    private val LABELS = mapOf(
        "diagnose" to "Diagnose",
        "positionierung" to "Positionierung",
        "nische" to "Nische",
        "zielgruppe" to "Zielgruppe",
        "alleinstellung" to "Alleinstellung",
        "profilVersprechen" to "Profil-Versprechen",
        "bioVorschlag" to "Bio-Vorschlag",
        "contentSaeulen" to "Content-Säulen",
        "anteilProzent" to "Anteil",
        "warum" to "Warum",
        "beispielThemen" to "Beispiel-Themen",
        "hooks" to "Hooks",
        "text" to "Text",
        "typ" to "Typ",
        "zielgruppeHook" to "Zielgruppe",
        "postingPlan" to "Posting-Plan",
        "tag" to "Tag",
        "uhrzeit" to "Uhrzeit",
        "format" to "Format",
        "thema" to "Thema",
        "hook" to "Hook",
        "hashtagStrategie" to "Hashtag-Strategie",
        "reichweite" to "Reichweite",
        "marke" to "Marke",
        "soundStrategie" to "Sound-Strategie",
        "seoKeywords" to "SEO-Keywords",
        "wachstumshebel" to "Wachstumshebel",
        "hebel" to "Hebel",
        "schritte" to "Schritte",
        "kpiZiele" to "KPI-Ziele",
        "followerIn30Tagen" to "Follower in 30 Tagen",
        "viewsProVideo" to "Views pro Video",
        "engagementRateProzent" to "Engagement-Rate",
        "warnung" to "Warnung",
        "score" to "Score",
        "zusammenfassung" to "Zusammenfassung",
        "staerken" to "Stärken",
        "schwaechen" to "Schwächen",
        "schnellsteWins" to "Schnellste Wins",
        "massnahme" to "Maßnahme",
        "erwarteteWirkung" to "Erwartete Wirkung",
        "aufwand" to "Aufwand",
        "umsetzungInMinuten" to "Umsetzung (Minuten)",
        "contentLuecken" to "Content-Lücken",
        "risiken" to "Risiken",
        "fazit" to "Fazit",
        "ideen" to "Ideen",
        "titel" to "Titel",
        "drehbuch" to "Drehbuch",
        "sekunde" to "Sekunde",
        "bild" to "Bild",
        "cta" to "Call-to-Action",
        "warumEsFunktioniert" to "Warum es funktioniert",
        "hashtags" to "Hashtags",
        "sound" to "Sound",
        "schwierigkeit" to "Schwierigkeit",
        "ziel" to "Ziel",
        "captions" to "Captions",
        "caption" to "Caption",
        "onScreenText" to "On-Screen-Text",
        "begruendung" to "Begründung",
        "hinweis" to "Hinweis",
        "tage" to "7-Tage-Plan",
        "suchbegriffe" to "Suchbegriffe",
        "rohtext" to "Antwort der KI",
        "usage" to "Verbrauch",
    )

    fun fileName(title: String, date: Date = Date()): String {
        val slug = title.lowercase(Locale.GERMANY)
            .replace("ä", "ae")
            .replace("ö", "oe")
            .replace("ü", "ue")
            .replace("ß", "ss")
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
        val day = SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(date)
        return "tiktok-growth-lab-" + slug.ifBlank { "ki-antwort" } + "-" + day + ".txt"
    }

    fun build(title: String, model: String, handle: String?, raw: String, date: Date = Date()): String {
        val out = StringBuilder()
        out.append("TikTok Growth Lab\n")
        out.append(title).append("\n")
        out.append("Datum: ").append(SimpleDateFormat("dd.MM.yyyy, HH:mm", Locale.GERMANY).format(date)).append("\n")
        if (!handle.isNullOrBlank()) out.append("Account: @").append(handle).append("\n")
        out.append("Modell: ").append(model.ifBlank { "unbekannt" }).append("\n\n")
        out.append("=".repeat(64)).append("\n\n")

        val root = parse(raw)
        if (root == null) {
            wrap(raw.ifBlank { "Keine Antwort erhalten." }, 0).forEach { out.append(it).append("\n") }
        } else {
            val keys = root.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val value = root.opt(key)
                out.append(label(key).uppercase(Locale.GERMANY)).append("\n\n")
                when {
                    isPrimitive(value) -> wrap(primitive(value), 2)
                    value is JSONArray -> renderArray(value, 0)
                    value is JSONObject -> renderEntry(key, value, 0).drop(1)
                    else -> listOf("-")
                }.forEach { out.append(it).append("\n") }
                out.append("\n")
            }
        }
        return out.toString().trimEnd() + "\n"
    }

    private fun parse(raw: String): JSONObject? {
        val cleaned = raw.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
        runCatching { return JSONObject(cleaned) }
        val start = cleaned.indexOf('{')
        if (start < 0) return null
        var depth = 0
        var inString = false
        var escaped = false
        for (index in start until cleaned.length) {
            val char = cleaned[index]
            if (escaped) {
                escaped = false
                continue
            }
            if (char == '\\') {
                escaped = true
                continue
            }
            if (char == '"') inString = !inString
            if (inString) continue
            if (char == '{') depth++
            if (char == '}') {
                depth--
                if (depth == 0) return runCatching { JSONObject(cleaned.substring(start, index + 1)) }.getOrNull()
            }
        }
        return null
    }

    private fun label(key: String): String = LABELS[key] ?: key
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .replace('_', ' ')
        .replaceFirstChar { it.uppercase(Locale.GERMANY) }

    private fun isPrimitive(value: Any?): Boolean =
        value == null || value == JSONObject.NULL || value is String || value is Number || value is Boolean

    private fun primitive(value: Any?): String = when {
        value == null || value == JSONObject.NULL -> "-"
        value is Boolean -> if (value) "ja" else "nein"
        value is Number -> {
            val number = value.toDouble()
            if (number % 1.0 == 0.0) NumberFormat.getIntegerInstance(Locale.GERMANY).format(number.toLong())
            else String.format(Locale.GERMANY, "%.2f", number)
        }
        else -> value.toString()
    }

    private fun wrap(text: String, indent: Int): List<String> {
        val pad = " ".repeat(indent)
        val words = text.replace(Regex("\\s+"), " ").trim().split(" ").filter { it.isNotEmpty() }
        if (words.isEmpty()) return listOf("$pad-")
        val lines = mutableListOf<String>()
        var current = ""
        for (word in words) {
            if (current.isNotEmpty() && pad.length + current.length + 1 + word.length > WIDTH) {
                lines.add(pad + current)
                current = word
            } else {
                current = if (current.isEmpty()) word else "$current $word"
            }
        }
        if (current.isNotEmpty()) lines.add(pad + current)
        return lines
    }

    private fun wrapItem(text: String, indent: Int, bullet: String): List<String> {
        val lines = wrap(text, indent + bullet.length).toMutableList()
        lines[0] = " ".repeat(indent) + bullet + lines[0].trimStart()
        return lines
    }

    private fun renderArray(items: JSONArray, depth: Int): List<String> {
        val pad = "  ".repeat(depth)
        val out = mutableListOf<String>()
        for (index in 0 until items.length()) {
            val item = items.opt(index)
            when {
                isPrimitive(item) -> out.addAll(wrapItem(primitive(item), pad.length, "- "))
                item is JSONObject -> {
                    val headKey = item.keys().asSequence().firstOrNull { HEAD_KEYS.contains(it) }
                    val head = headKey?.let { primitive(item.opt(it)) } ?: "Eintrag ${index + 1}"
                    out.addAll(wrapItem(head, pad.length, "${index + 1}. "))
                    val keys = item.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        if (key == headKey) continue
                        out.addAll(renderEntry(key, item.opt(key), depth + 1))
                    }
                    out.add("")
                }
                item is JSONArray -> out.addAll(renderArray(item, depth + 1))
            }
        }
        while (out.isNotEmpty() && out.last() == "") out.removeAt(out.lastIndex)
        return out
    }

    private fun renderEntry(key: String, value: Any?, depth: Int): List<String> {
        val pad = "  ".repeat(depth)
        val name = label(key)
        return when {
            isPrimitive(value) -> {
                val text = primitive(value)
                if (value is String && pad.length + name.length + text.length > WIDTH - 8) {
                    listOf("$pad$name:") + wrap(text, pad.length + 2)
                } else {
                    listOf("$pad$name: $text")
                }
            }
            value is JSONArray -> if (value.length() == 0) {
                listOf("$pad$name: -")
            } else {
                listOf("$pad$name:") + renderArray(value, depth + 1)
            }
            value is JSONObject -> {
                val out = mutableListOf("$pad$name:")
                val keys = value.keys()
                while (keys.hasNext()) {
                    val child = keys.next()
                    out.addAll(renderEntry(child, value.opt(child), depth + 1))
                }
                out
            }
            else -> listOf("$pad$name: -")
        }
    }
}
