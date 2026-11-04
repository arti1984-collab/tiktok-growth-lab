package de.artur.growthlab.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap
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

    /** Filled from the settings, empty means the plain visit without login. */
    @Volatile
    var cookie: String = ""

    /** Ten minutes of memory: a second look at the same profile spares TikTok a request. */
    private const val CACHE_TTL_MS = 10 * 60 * 1000L
    private val cache = ConcurrentHashMap<String, Pair<Long, String>>()

    fun clearCache() = cache.clear()

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

    private suspend fun fetch(url: String): String = getText(url, "text/html,application/xhtml+xml,*/*;q=0.8", null)

    private suspend fun getText(url: String, accept: String, referer: String?): String = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        cache[url]?.let { (expires, body) -> if (expires > now) return@withContext body }

        val builder = Request.Builder()
            .url(url)
            .header("User-Agent", UA)
            .header("Accept-Language", "de-DE,de;q=0.9,en;q=0.8")
            .header("Accept", accept)
        if (!referer.isNullOrBlank()) builder.header("Referer", referer)
        if (cookie.isNotBlank()) builder.header("Cookie", cookie)
        val request = builder.build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (response.isSuccessful) {
                    cache[url] = (System.currentTimeMillis() + CACHE_TTL_MS) to body
                    return@withContext body
                }
                when (response.code) {
                    404 -> throw TikTokException(
                        "NOT_FOUND",
                        tr("Diesen Account oder dieses Video gibt es nicht.", "This account or video does not exist."),
                    )
                    403 -> throw TikTokException(
                        "BLOCKED",
                        tr("TikTok blockt die Anfrage (403).", "TikTok blocks the request (403)."),
                        tr(
                            "Öffne tiktok.com im Browser, löse ein Captcha und versuche es danach erneut.",
                            "Open tiktok.com in a browser, solve a captcha and try again afterwards.",
                        ),
                    )
                    429 -> throw TikTokException(
                        "RATE_LIMIT",
                        tr("TikTok drosselt gerade die Anfragen.", "TikTok is throttling the requests."),
                        tr("Warte ein bis zwei Minuten und starte den Scan erneut.", "Wait one or two minutes and run the scan again."),
                    )
                    else -> throw TikTokException(
                        "NETWORK",
                        tr("TikTok antwortet mit HTTP ${response.code}.", "TikTok answers with HTTP ${response.code}."),
                    )
                }
            }
        } catch (error: TikTokException) {
            throw error
        } catch (error: Exception) {
            throw TikTokException(
                "NETWORK",
                tr("Keine Verbindung zu TikTok.", "No connection to TikTok."),
                error.message?.take(140) ?: tr("Prüfe deine Internetverbindung.", "Check your internet connection."),
            )
        }
    }

    fun normalizeHandle(raw: String): String {
        val input = raw.trim()
        if (input.isEmpty()) throw TikTokException("NOT_FOUND", tr("Bitte einen TikTok-Namen eingeben.", "Please enter a TikTok name."))
        Regex("tiktok\\.com/@([A-Za-z0-9._]+)", RegexOption.IGNORE_CASE).find(input)?.let { return it.groupValues[1] }
        val cleaned = input.trimStart('@').split('?', '#', '/').first().trim()
        if (!Regex("^[A-Za-z0-9._]{2,24}$").matches(cleaned)) {
            throw TikTokException(
                "NOT_FOUND",
                tr("\"${input.take(40)}\" ist kein gültiger TikTok-Name.", "\"${input.take(40)}\" is not a valid TikTok name."),
            )
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
        val html = fetch("https://www.tiktok.com/@$handle?lang=${if (english()) "en" else "de"}")
        val scope = extractScope(html)
            ?: throw TikTokException(
                "PARSE",
                tr("TikTok hat für @$handle keine verwertbaren Daten geliefert.", "TikTok returned no usable data for @$handle."),
                tr("Prüfe den Namen.", "Check the name."),
            )
        val detail = scope.optJSONObject("webapp.user-detail")
            ?: throw TikTokException(
                "NOT_FOUND",
                tr("@$handle existiert nicht oder ist gesperrt.", "@$handle does not exist or is blocked."),
            )
        if (detail.optInt("statusCode", 0) != 0) {
            throw TikTokException(
                "NOT_FOUND",
                tr("@$handle existiert nicht oder ist gesperrt.", "@$handle does not exist or is blocked."),
            )
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
    /** Both app ids answer this route; the second one is tried when the first stays empty. */
    private val creatorAids = listOf(1988, 1180)

    private suspend fun fetchCreatorList(secUid: String, referer: String, count: Int): List<JSONObject> {
        var lastError: Exception? = null
        for ((index, aid) in creatorAids.withIndex()) {
            val url = "https://www.tiktok.com/api/creator/item_list/?aid=$aid" +
                "&secUid=${URLEncoder.encode(secUid, "UTF-8")}&type=1&count=$count&cursor=0"
            try {
                val body = getText(url, "application/json, text/plain, */*", referer)
                val payload = try {
                    JSONObject(body)
                } catch (error: Exception) {
                    throw TikTokException("PARSE", tr("TikTok liefert gerade keine Videoliste.", "TikTok is returning no video list right now."))
                }
                if (payload.optInt("statusCode", 0) != 0) {
                    throw TikTokException(
                        "PARSE",
                        tr("TikTok liefert für diesen Account gerade keine Videoliste.", "TikTok is returning no video list for this account right now."),
                    )
                }
                val items = payload.optJSONArray("itemList")
                val list = if (items == null) emptyList() else (0 until items.length()).mapNotNull { items.optJSONObject(it) }
                if (list.isNotEmpty()) return list
                lastError = TikTokException(
                    "PARSE",
                    tr("TikTok liefert gerade keine Videoliste.", "TikTok is returning no video list right now."),
                )
            } catch (error: Exception) {
                lastError = error
                if (error is TikTokException && (error.code == "NOT_FOUND" || error.code == "BLOCKED")) throw error
            }
            if (index < creatorAids.lastIndex) delay(2500)
        }
        throw lastError ?: TikTokException(
            "PARSE",
            tr("TikTok liefert gerade keine Videoliste.", "TikTok is returning no video list right now."),
            tr("Später erneut versuchen oder Links einfügen.", "Try again later or add links."),
        )
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
