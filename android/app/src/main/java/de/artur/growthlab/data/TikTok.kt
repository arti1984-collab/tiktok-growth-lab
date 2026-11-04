package de.artur.growthlab.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class TikTokException(
    val code: String,
    message: String,
    val hint: String = "",
) : Exception(message)

/**
 * Reads TikTok the same way the desktop app does: only from the SSR JSON island
 * of the public profile/video pages, one request at a time, no login.
 */
object TikTok {

    private const val UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .build()
    }

    private val scopeRegex = Regex(
        "<script id=\"__UNIVERSAL_DATA_FOR_REHYDRATION__\" type=\"application/json\">([\\s\\S]*?)</script>",
    )

    private suspend fun fetch(url: String): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", UA)
            .header("Accept-Language", "de-DE,de;q=0.9,en;q=0.8")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (response.isSuccessful) return@withContext body
                when (response.code) {
                    404 -> throw TikTokException("NOT_FOUND", "Diesen Account oder dieses Video gibt es nicht.")
                    403 -> throw TikTokException(
                        "BLOCKED",
                        "TikTok blockt die Anfrage (403).",
                        "Öffne tiktok.com im Browser, löse ein Captcha und versuche es danach erneut.",
                    )
                    429 -> throw TikTokException(
                        "RATE_LIMIT",
                        "TikTok drosselt gerade die Anfragen.",
                        "Warte ein bis zwei Minuten und starte den Scan erneut.",
                    )
                    else -> throw TikTokException("NETWORK", "TikTok antwortet mit HTTP ${response.code}.")
                }
            }
        } catch (error: TikTokException) {
            throw error
        } catch (error: Exception) {
            throw TikTokException(
                "NETWORK",
                "Keine Verbindung zu TikTok.",
                error.message?.take(140) ?: "Prüfe deine Internetverbindung.",
            )
        }
    }

    fun normalizeHandle(raw: String): String {
        val input = raw.trim()
        if (input.isEmpty()) throw TikTokException("NOT_FOUND", "Bitte einen TikTok-Namen eingeben.")
        Regex("tiktok\\.com/@([A-Za-z0-9._]+)", RegexOption.IGNORE_CASE).find(input)?.let { return it.groupValues[1] }
        val cleaned = input.trimStart('@').split('?', '#', '/').first().trim()
        if (!Regex("^[A-Za-z0-9._]{2,24}$").matches(cleaned)) {
            throw TikTokException("NOT_FOUND", "\"${input.take(40)}\" ist kein gültiger TikTok-Name.")
        }
        return cleaned
    }

    private fun extractScope(html: String): JSONObject? {
        val match = scopeRegex.find(html) ?: return null
        return try {
            JSONObject(match.groupValues[1]).optJSONObject("__DEFAULT_SCOPE__")
        } catch (error: Exception) {
            null
        }
    }

    suspend fun getProfile(rawHandle: String): Profile {
        val handle = normalizeHandle(rawHandle)
        val html = fetch("https://www.tiktok.com/@$handle?lang=de")
        val scope = extractScope(html)
            ?: throw TikTokException("PARSE", "TikTok hat für @$handle keine verwertbaren Daten geliefert.", "Prüfe den Namen.")
        val detail = scope.optJSONObject("webapp.user-detail")
            ?: throw TikTokException("NOT_FOUND", "@$handle existiert nicht oder ist gesperrt.")
        if (detail.optInt("statusCode", 0) != 0) {
            throw TikTokException("NOT_FOUND", "@$handle existiert nicht oder ist gesperrt.")
        }
        val info = detail.optJSONObject("userInfo") ?: JSONObject()
        val user = info.optJSONObject("user") ?: JSONObject()
        val stats = info.optJSONObject("stats") ?: JSONObject()
        val uniqueId = user.optString("uniqueId", handle)

        return Profile(
            handle = uniqueId,
            nickname = user.optString("nickname", handle),
            bio = user.optString("signature", ""),
            avatar = user.optString("avatarMedium", user.optString("avatarThumb", "")),
            verified = user.optBoolean("verified", false),
            region = user.optString("region", ""),
            followers = stats.optLong("followerCount", 0),
            following = stats.optLong("followingCount", 0),
            hearts = stats.optLong("heartCount", stats.optLong("heart", 0)),
            videos = stats.optLong("videoCount", 0),
            url = "https://www.tiktok.com/@$uniqueId",
            secUid = user.optString("secUid", ""),
        )
    }

    /**
     * TikTok's public creator list answers without a signature and returns up to
     * 15 of the newest videos. The list the web app itself calls is signed and
     * answers with an empty body here.
     */
    private suspend fun fetchCreatorList(secUid: String, referer: String, count: Int): List<JSONObject> =
        withContext(Dispatchers.IO) {
            val url = "https://www.tiktok.com/api/creator/item_list/?aid=1988" +
                "&secUid=${URLEncoder.encode(secUid, "UTF-8")}&type=1&count=$count&cursor=0"
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", UA)
                .header("Accept", "application/json, text/plain, */*")
                .header("Referer", referer)
                .build()

            val body = try {
                client.newCall(request).execute().use { response ->
                    val text = response.body?.string().orEmpty()
                    if (response.code == 429) {
                        throw TikTokException("RATE_LIMIT", "TikTok drosselt gerade die Anfragen.")
                    }
                    if (text.isBlank()) {
                        throw TikTokException("PARSE", "TikTok liefert gerade keine Videoliste.")
                    }
                    text
                }
            } catch (error: TikTokException) {
                throw error
            } catch (error: Exception) {
                throw TikTokException("NETWORK", "Keine Verbindung zu TikTok.", error.message?.take(140).orEmpty())
            }

            val payload = try {
                JSONObject(body)
            } catch (error: Exception) {
                throw TikTokException("PARSE", "TikTok liefert gerade keine Videoliste.")
            }
            if (payload.optInt("statusCode", 0) != 0) {
                throw TikTokException("PARSE", "TikTok liefert für diesen Account gerade keine Videoliste.")
            }
            val items = payload.optJSONArray("itemList") ?: return@withContext emptyList()
            (0 until items.length()).mapNotNull { items.optJSONObject(it) }
        }

    suspend fun getUserVideos(profile: Profile, count: Int = 15): List<Video> {
        if (profile.secUid.isBlank()) throw TikTokException("PARSE", "Dieses Profil liefert keine secUid.")
        return fetchCreatorList(profile.secUid, profile.url, count.coerceIn(1, 15))
            .map { mapVideo(it, profile.handle) }
            .filter { it.id.isNotEmpty() }
    }

    private fun parseVideoRef(raw: String): Pair<String?, String> {
        val input = raw.trim()
        Regex("tiktok\\.com/@([A-Za-z0-9._]+)/(?:video|photo)/(\\d+)", RegexOption.IGNORE_CASE).find(input)?.let {
            return it.groupValues[1] to it.groupValues[2]
        }
        Regex("@([A-Za-z0-9._]+).*?(\\d{16,20})").find(input)?.let {
            return it.groupValues[1] to it.groupValues[2]
        }
        Regex("^(\\d{16,20})$").find(input)?.let { return null to it.groupValues[1] }
        throw TikTokException("NOT_FOUND", "Kein TikTok-Video-Link: ${input.take(60)}")
    }

    private fun mapVideo(item: JSONObject, fallbackHandle: String): Video {
        val stats = item.optJSONObject("stats") ?: JSONObject()
        val video = item.optJSONObject("video") ?: JSONObject()
        val music = item.optJSONObject("music") ?: JSONObject()
        val author = item.optJSONObject("author") ?: JSONObject()
        val handle = author.optString("uniqueId", fallbackHandle)
        val id = item.optString("id", "")
        val hashtags = mutableListOf<String>()
        val challenges = item.optJSONArray("challenges")
        if (challenges != null) {
            for (index in 0 until challenges.length()) {
                val title = challenges.optJSONObject(index)?.optString("title", "").orEmpty()
                if (title.isNotEmpty()) hashtags.add(title)
            }
        }
        val musicTitle = music.optString("title", "")
        return Video(
            id = id,
            url = "https://www.tiktok.com/@$handle/video/$id",
            desc = item.optString("desc", ""),
            createdAt = item.optLong("createTime", 0),
            durationSec = video.optInt("duration", 0),
            views = stats.optLong("playCount", 0),
            likes = stats.optLong("diggCount", 0),
            comments = stats.optLong("commentCount", 0),
            shares = stats.optLong("shareCount", 0),
            saves = stats.optLong("collectCount", 0),
            author = handle,
            hashtags = hashtags,
            thumbnail = video.optString("cover", video.optString("originCover", "")),
            originalSound = music.optBoolean("original", false) || musicTitle.contains("original sound", true),
        )
    }

    suspend fun getVideo(handle: String, id: String): Video {
        val html = fetch("https://www.tiktok.com/@$handle/video/$id?lang=de")
        val scope = extractScope(html)
            ?: throw TikTokException("PARSE", "TikTok liefert zum Video $id keine Daten.")
        val detail = scope.optJSONObject("webapp.video-detail")
            ?: throw TikTokException("NOT_FOUND", "Video $id ist nicht mehr online.")
        val item = detail.optJSONObject("itemInfo")?.optJSONObject("itemStruct")
            ?: throw TikTokException("NOT_FOUND", "TikTok liefert zum Video $id keine Daten.")
        return mapVideo(item, handle)
    }

    suspend fun getVideoFromInput(raw: String): Video {
        val (handle, id) = parseVideoRef(raw)
        if (handle != null) return getVideo(handle, id)
        throw TikTokException(
            "NOT_FOUND",
            "Zu $id fehlt der Creator-Name.",
            "Kopiere den vollständigen Link, z. B. https://www.tiktok.com/@name/video/123…",
        )
    }

    /** Reads the profile plus every video link, with a polite pause between requests. */
    suspend fun scan(
        rawHandle: String,
        videoLinks: List<String>,
        onProgress: (done: Int, total: Int) -> Unit = { _, _ -> },
    ): ScanResult {
        val profile = getProfile(rawHandle)
        val links = videoLinks.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
        val videos = mutableListOf<Video>()
        val warnings = mutableListOf<String>()

        onProgress(0, links.size)
        val automatic = try {
            getUserVideos(profile)
        } catch (error: Exception) {
            warnings.add("Videoliste von TikTok nicht lesbar: ${error.message}")
            emptyList()
        }

        for ((index, link) in links.withIndex()) {
            try {
                videos.add(getVideoFromInput(link))
            } catch (error: Exception) {
                warnings.add("${link.take(70)} → ${error.message}")
                if (error is TikTokException && error.code == "RATE_LIMIT") {
                    warnings.add("Scan abgebrochen: TikTok drosselt. Bitte später erneut versuchen.")
                    break
                }
            }
            onProgress(index + 1, links.size)
            if (index < links.lastIndex) kotlinx.coroutines.delay(1200)
        }

        val automaticNew = automatic.filter { candidate -> videos.none { it.id == candidate.id } }
        videos.addAll(automaticNew)

        val own = videos.filter { it.author.equals(profile.handle, ignoreCase = true) }
        if (videos.isNotEmpty() && own.isEmpty()) {
            warnings.add("Kein Video gehört zu diesem Profil – die Analyse zeigt die Performance der verlinkten Videos.")
        }
        if (videos.isEmpty()) {
            warnings.add(
                "TikTok hat zu diesem Profil keine Videos geliefert. Private Konten geben keine heraus, sonst später erneut scannen oder Links einfügen.",
            )
        }

        val metrics = MetricsEngine.compute(profile, if (own.isNotEmpty()) own else videos)
        return ScanResult(profile, videos, metrics, warnings, System.currentTimeMillis())
    }
}
