package de.artur.growthlab.data

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

/** Free-tier provider presets, same list as the desktop app. */
object Provider {
    const val GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"

    val GEMINI_MODELS = listOf(
        "gemini-3.8-flash" to "Gemini 3.8 Flash",
        "gemini-3.6-flash" to "Gemini 3.6 Flash",
        "gemini-3.5-flash-lite" to "Gemini 3.5 Flash-Lite",
        "gemini-2.5-flash" to "Gemini 2.5 Flash",
    )

    data class Entry(
        val id: String,
        val name: String,
        val baseUrl: String,
        val freeNote: String,
        val models: List<Pair<String, String>>,
    )

    val entries = listOf(
        Entry(
            "gemini",
            "Google Gemini",
            GEMINI_BASE,
            "Dauerhaft kostenlos, ohne Kreditkarte. Free-Tier-Anfragen darf Google zum Verbessern der Produkte nutzen.",
            GEMINI_MODELS,
        ),
        Entry(
            "groq",
            "Groq",
            "https://api.groq.com/openai/v1",
            "Kostenlos ohne Kreditkarte, sehr schnelle Antworten. 30 Anfragen/Minute, 1.000/Tag.",
            listOf(
                "openai/gpt-oss-120b" to "GPT-OSS 120B",
                "openai/gpt-oss-20b" to "GPT-OSS 20B",
                "qwen/qwen3.8-27b" to "Qwen 3.8 27B",
            ),
        ),
        Entry(
            "openrouter",
            "OpenRouter",
            "https://openrouter.ai/api/v1",
            "Ein Key für viele Modelle. Alles mit :free kostet nichts – 20 Anfragen/Minute, 50/Tag.",
            listOf(
                "nvidia/nemotron-3.5-lightning:free" to "Nemotron 3.5 Lightning",
                "google/gemma-4-31b-it:free" to "Gemma 4 31B",
                "thinkingmachines/inkling:free" to "Inkling",
                "nvidia/nemotron-3-ultra-550b-a55b:free" to "Nemotron 3 Ultra",
            ),
        ),
    )
}

object Ai {
    class AiException(val code: String, message: String, val hint: String = "") : Exception(message)

    private val client: okhttp3.OkHttpClient by lazy {
        okhttp3.OkHttpClient.Builder()
            .connectTimeout(25, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }

    private fun request(
        url: String,
        apiKey: String,
        body: org.json.JSONObject?,
    ): Triple<Int, String, String> {
        val builder = okhttp3.Request.Builder()
            .url(url)
            .header("accept", "application/json")
        if (apiKey.isNotBlank()) builder.header("authorization", "Bearer $apiKey")
        if (body != null) {
            builder.post(body.toString().toRequestBody("application/json".toMediaType()))
        }
        return try {
            client.newCall(builder.build()).execute().use { response ->
                Triple(response.code, response.body?.string().orEmpty(), response.message)
            }
        } catch (error: Exception) {
            throw AiException(
                "PROVIDER",
                tr("Der KI-Anbieter ist nicht erreichbar.", "The AI provider cannot be reached."),
                error.message?.take(140) ?: tr("Prüfe die Basis-URL und deine Verbindung.", "Check the base URL and your connection."),
            )
        }
    }

    private fun providerMessage(text: String): String {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return ""
        return try {
            val node = if (trimmed.startsWith("[")) org.json.JSONArray(trimmed).optJSONObject(0) else org.json.JSONObject(trimmed)
            node?.optJSONObject("error")?.optString("message", "")?.takeIf { it.isNotBlank() } ?: trimmed.take(300)
        } catch (error: Exception) {
            trimmed.take(300)
        }
    }

    private fun isOverload(status: Int, message: String): Boolean =
        status in listOf(500, 502, 503, 504, 529) ||
            Regex("high demand|overload|unavailable|temporar|try again later|capacity", RegexOption.IGNORE_CASE).containsMatchIn(message)

    private fun mapError(status: Int, message: String): AiException = when {
        isOverload(status, message) -> AiException(
            "OVERLOAD",
            tr("Der KI-Anbieter ist gerade überlastet (HTTP $status).", "The AI provider is overloaded right now (HTTP $status)."),
            tr(
                "Meist vorübergehend: gleich erneut versuchen oder ein kleineres Modell wählen (Flash-Lite). Anbieter-Meldung: ${message.take(200)}",
                "Usually temporary: try again in a moment or pick a smaller model (Flash-Lite). Provider message: ${message.take(200)}",
            ),
        )
        status == 401 || status == 403 -> AiException(
            "AUTH",
            tr("Der API-Key wurde abgelehnt (HTTP $status).", "The API key was rejected (HTTP $status)."),
            tr("Prüfe den Key unter Einstellungen.", "Check the key in the settings."),
        )
        status == 404 -> AiException(
            "MODEL",
            tr("Modell oder Basis-URL nicht gefunden (404).", "Model or base URL not found (404)."),
            tr(
                "Prüfe Basis-URL und Modellnamen – „Modelle laden“ zeigt, was der Anbieter anbietet.",
                "Check the base URL and the model name – \"Load models\" shows what the provider offers.",
            ),
        )
        status == 429 -> AiException(
            "RATE_LIMIT",
            tr("Der KI-Anbieter drosselt gerade (429).", "The AI provider is throttling right now (429)."),
            tr(
                "Free-Tier-Limit erreicht: kurz warten, Modell wechseln oder anderen Anbieter nehmen.",
                "Free tier limit reached: wait a moment, change the model or pick another provider.",
            ),
        )
        else -> AiException(
            "PROVIDER",
            tr("Der KI-Anbieter antwortet mit HTTP $status.", "The AI provider answers with HTTP $status."),
            message.take(250),
        )
    }

    suspend fun listModels(settings: AiSettings): List<String> = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val base = settings.baseUrl.trimEnd('/')
        val (status, body, _) = request("$base/models", settings.apiKey, null)
        if (status != 200) throw mapError(status, providerMessage(body))
        val array = org.json.JSONObject(body).optJSONArray("data") ?: org.json.JSONArray()
        val models = (0 until array.length()).mapNotNull { array.optJSONObject(it)?.optString("id")?.takeIf { id -> id.isNotBlank() } }
        models.sorted()
    }

    suspend fun chat(
        settings: AiSettings,
        system: String,
        user: String,
        json: Boolean = true,
        temperature: Double = 0.7,
    ): String = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        if (settings.apiKey.isBlank()) {
            throw AiException(
                "NO_KEY",
                tr("Kein KI-Key hinterlegt.", "No AI key stored."),
                tr(
                    "Trage unter Einstellungen einen kostenlosen Key ein (Google AI Studio, Groq oder OpenRouter). Scannen und Rechnen funktionieren auch ohne.",
                    "Add a free key in the settings (Google AI Studio, Groq or OpenRouter). Scanning and the numbers work without one.",
                ),
            )
        }
        val base = settings.baseUrl.trimEnd('/')
        val messages = org.json.JSONArray()
            .put(org.json.JSONObject().put("role", "system").put("content", system))
            .put(org.json.JSONObject().put("role", "user").put("content", user))
        val payload = org.json.JSONObject()
            .put("model", settings.model)
            .put("messages", messages)
            .put("temperature", temperature)
            .put("max_tokens", 3000)
        if (json) payload.put("response_format", org.json.JSONObject().put("type", "json_object"))

        var (status, body, _) = request("$base/chat/completions", settings.apiKey, payload)
        var message = providerMessage(body)
        for (delay in listOf(900L, 2500L)) {
            if (!isOverload(status, message)) break
            kotlinx.coroutines.delay(delay)
            val retry = request("$base/chat/completions", settings.apiKey, payload)
            status = retry.first
            body = retry.second
            message = providerMessage(body)
        }
        if (status != 200) throw mapError(status, message)

        val content = try {
            org.json.JSONObject(body).optJSONArray("choices")?.optJSONObject(0)
                ?.optJSONObject("message")?.optString("content", "").orEmpty()
        } catch (error: Exception) {
            ""
        }
        if (content.isBlank()) {
            throw AiException(
                "PROVIDER",
                tr("Der Anbieter hat eine leere Antwort geliefert.", "The provider returned an empty answer."),
                message.take(200).ifBlank { tr("Oft ein Zeichen für Überlastung.", "Often a sign of overload.") },
            )
        }
        content
    }

    /**
     * Ein Komma vor der schliessenden Klammer oder ein echter Zeilenumbruch im
     * Text sind die haeufigsten Fehler einer Modellantwort. Beides wird
     * repariert, statt die ganze Antwort zu verwerfen.
     */
    private fun repairJson(raw: String): String {
        val out = StringBuilder(raw.length + 16)
        var inString = false
        var escaped = false
        for (index in raw.indices) {
            val char = raw[index]
            if (escaped) {
                out.append(char)
                escaped = false
                continue
            }
            if (char == '\\') {
                out.append(char)
                escaped = true
                continue
            }
            if (char == '"') {
                inString = !inString
                out.append(char)
                continue
            }
            if (inString) {
                when (char) {
                    '\n' -> out.append("\\n")
                    '\r' -> Unit
                    '\t' -> out.append("\\t")
                    else -> out.append(char)
                }
                continue
            }
            if (char == ',') {
                var next = index + 1
                while (next < raw.length && raw[next].isWhitespace()) next += 1
                if (next < raw.length && (raw[next] == '}' || raw[next] == ']')) {
                    out.append(' ')
                    continue
                }
            }
            out.append(char)
        }
        return out.toString()
    }

    private fun parses(chunk: String): Boolean {
        if (runCatching { org.json.JSONObject(chunk) }.isSuccess) return true
        return runCatching { org.json.JSONArray(chunk) }.isSuccess
    }

    /** Pulls the first JSON object out of an answer that may contain prose or code fences. */
    fun extractJson(text: String): Boolean {
        val cleaned = text.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
        val start = cleaned.indexOfFirst { it == '{' || it == '[' }
        if (start < 0) return false
        val open = cleaned[start]
        val close = if (open == '{') '}' else ']'
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
            if (char == open) depth++
            if (char == close) {
                depth--
                if (depth == 0) {
                    val chunk = cleaned.substring(start, index + 1)
                    return parses(chunk) || parses(repairJson(chunk))
                }
            }
        }
        return false
    }
}
