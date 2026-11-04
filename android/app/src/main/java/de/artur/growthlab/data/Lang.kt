package de.artur.growthlab.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class Lang(val code: String) {
    DE("de"),
    EN("en"),
    ;

    companion object {
        fun fromCode(code: String?): Lang = if (code == "en") EN else DE
    }
}

/**
 * Die Sprache liegt als beobachtbarer Zustand: jede Oberfläche, die [Lang]
 * liest, zeichnet sich beim Umschalten von selbst neu.
 */
object Language {
    var current: Lang by mutableStateOf(Lang.DE)

    val isEnglish: Boolean
        get() = current == Lang.EN

    val locale: Locale
        get() = if (isEnglish) Locale.US else Locale.GERMANY
}

/** tr("Deutsch", "English") – der kurze Weg für Texte, die nur an einer Stelle stehen. */
fun tr(de: String, en: String): String = if (Language.isEnglish) en else de

fun english(): Boolean = Language.isEnglish

val weekdayNames: List<String>
    get() = if (Language.isEnglish) {
        listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    } else {
        listOf("Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag")
    }

fun weekdayName(index: Int): String = weekdayNames.getOrElse(index) { "?" }

/** Datum und Uhrzeit in der eingestellten Sprechweise. */
fun formatDateTime(millis: Long): String =
    SimpleDateFormat(if (Language.isEnglish) "MM/dd/yy, hh:mm a" else "dd.MM.yy, HH:mm", Language.locale).format(Date(millis))

fun formatDateOnly(millis: Long): String =
    SimpleDateFormat(if (Language.isEnglish) "MM/dd/yy" else "dd.MM.yy", Language.locale).format(Date(millis))
