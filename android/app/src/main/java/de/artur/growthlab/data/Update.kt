package de.artur.growthlab.data

import de.artur.growthlab.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Fragt die neueste Veröffentlichung auf GitHub ab und vergleicht sie mit der
 * laufenden App. Ohne Netz bleibt es bei "kein Update", ohne Fehlermeldung.
 */
object Update {

    private const val REPO = "arti1984-collab/tiktok-growth-lab"

    data class Info(
        val current: String,
        val latest: String?,
        val available: Boolean,
        val url: String?,
        val exe: String?,
        val apk: String?,
        val error: String? = null,
    )

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    /** 1.8.0 gegen 1.10.0: Zahlen vergleichen, nicht Zeichenketten. */
    fun compare(left: String, right: String): Int {
        fun parts(value: String) = value
            .removePrefix("v")
            .split('.', '-', '+')
            .map { it.toIntOrNull() ?: 0 }

        val a = parts(left)
        val b = parts(right)
        for (index in 0 until maxOf(a.size, b.size)) {
            val one = a.getOrElse(index) { 0 }
            val two = b.getOrElse(index) { 0 }
            if (one != two) return if (one > two) 1 else -1
        }
        return 0
    }

    suspend fun check(): Info = withContext(Dispatchers.IO) {
        val current = BuildConfig.VERSION_NAME
        try {
            val request = Request.Builder()
                .url("https://api.github.com/repos/$REPO/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "TikTok-Growth-Lab")
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Info(
                        current = current,
                        latest = null,
                        available = false,
                        url = null,
                        exe = null,
                        apk = null,
                        error = when (response.code) {
                            401, 403, 429 -> tr(
                                "GitHub hat die Abfrage gedrosselt. In ein paar Minuten noch einmal.",
                                "GitHub throttled the request. Try again in a few minutes.",
                            )
                            404 -> tr("Es gibt noch keine veröffentlichte Version.", "There is no published release yet.")
                            else -> tr("Die Update-Abfrage hat nicht geklappt.", "The update check did not work.")
                        },
                    )
                }
                val body = JSONObject(response.body?.string().orEmpty())
                val latest = body.optString("tag_name", "").removePrefix("v").ifBlank { null }
                val assets = body.optJSONArray("assets")
                var apk: String? = null
                var exe: String? = null
                if (assets != null) {
                    for (index in 0 until assets.length()) {
                        val asset = assets.optJSONObject(index) ?: continue
                        val name = asset.optString("name", "").lowercase()
                        val url = asset.optString("browser_download_url", "")
                        if (name.endsWith(".apk")) apk = url
                        if (name.endsWith(".exe")) exe = url
                    }
                }
                Info(
                    current = current,
                    latest = latest,
                    available = latest != null && compare(latest, current) > 0,
                    url = body.optString("html_url", "").ifBlank { null },
                    exe = exe,
                    apk = apk,
                )
            }
        } catch (error: Exception) {
            Info(
                current = current,
                latest = null,
                available = false,
                url = null,
                exe = null,
                apk = null,
                error = tr("Die Update-Abfrage hat nicht geklappt.", "The update check did not work."),
            )
        }
    }
}
