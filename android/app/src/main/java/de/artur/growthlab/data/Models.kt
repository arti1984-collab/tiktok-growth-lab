package de.artur.growthlab.data

data class Profile(
    val handle: String,
    val nickname: String,
    val bio: String,
    val avatar: String,
    val verified: Boolean,
    val region: String,
    val followers: Long,
    val following: Long,
    val hearts: Long,
    val videos: Long,
    val url: String,
    val secUid: String = "",
)

data class Video(
    val id: String,
    val url: String,
    val desc: String,
    val createdAt: Long,
    val durationSec: Int,
    val views: Long,
    val likes: Long,
    val comments: Long,
    val shares: Long,
    val saves: Long,
    val author: String,
    val hashtags: List<String>,
    val thumbnail: String,
    val originalSound: Boolean,
)

data class Snapshot(
    val at: Long,
    val followers: Long,
    val following: Long,
    val hearts: Long,
    val videos: Long,
    val engagementRate: Double?,
    val score: Int?,
)

data class TrackedAccount(
    val handle: String,
    val nickname: String,
    val snapshots: List<Snapshot>,
)

data class Insight(val kind: String, val title: String, val text: String)

data class VideoSummary(
    val id: String,
    val url: String,
    val desc: String,
    val views: Long,
    val likes: Long,
    val createdAt: Long,
    val durationSec: Int,
    val engagementRate: Double,
    val multiple: Double,
)

data class Slot(val weekday: Int, val hour: Int, val avgViews: Long, val posts: Int)

data class DurationBucket(val label: String, val posts: Int, val avgViews: Long)

data class HashtagStat(val tag: String, val posts: Int, val avgViews: Long)

data class Metrics(
    val hasData: Boolean,
    val sampleSize: Int,
    val score: Int?,
    val engagementRate: Double?,
    val likeRate: Double,
    val commentRate: Double,
    val shareRate: Double,
    val saveRate: Double,
    val avgViews: Long,
    val medianViews: Long,
    val totalViews: Long,
    val viewsPerFollower: Double?,
    val postsPerWeek: Double?,
    val avgDaysBetweenPosts: Double?,
    val daysSinceLastPost: Double?,
    val avgDuration: Int,
    val bestSlots: List<Slot>,
    val durationBuckets: List<DurationBucket>,
    val hashtags: List<HashtagStat>,
    val topVideos: List<VideoSummary>,
    val flopVideos: List<VideoSummary>,
    val outlierCount: Int,
    val bestMultiple: Double,
    val avgDescLength: Int,
    val questionShare: Double,
    val emojiShare: Double,
    val avgHashtags: Double,
    val originalSoundShare: Double,
    val insights: List<Insight>,
)

data class ScanResult(
    val profile: Profile,
    val videos: List<Video>,
    val metrics: Metrics,
    val warnings: List<String>,
    val scannedAt: Long,
)

data class AiSettings(
    val baseUrl: String = Provider.GEMINI_BASE,
    val model: String = Provider.GEMINI_MODELS.first().first,
    val apiKey: String = "",
    /** "de" oder "en" – steuert Oberfläche und Sprache der KI-Antworten. */
    val language: String = "de",
    /** Nur Lesezugriff, nur für die Update-Abfrage. Bleibt lokal. */
    val githubToken: String = "",
)

/** Ein Termin im Wochenplan: Datum und Uhrzeit lokal, Video-URL nach dem Posten. */
data class PlanItem(
    val id: String,
    val date: String,
    val time: String,
    val note: String = "",
    val status: String = "planned",
    val videoUrl: String = "",
    val createdAt: Long = System.currentTimeMillis(),
)

data class AiAnswer(
    val mode: String,
    val model: String,
    val text: String,
    val parsed: Boolean,
)
