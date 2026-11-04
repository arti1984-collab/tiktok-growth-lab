package de.artur.growthlab.data

import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

/** Port of server/lib/metrics.ts – same numbers and wording as the desktop app. */
object MetricsEngine {

    /** Wochentagsnamen kommen aus Lang.kt und folgen der eingestellten Sprache. */
    val weekdayNames: List<String> get() = de.artur.growthlab.data.weekdayNames

    private fun fmt(value: Long): String = NumberFormat.getIntegerInstance(Language.locale).format(value)
    private fun pct(value: Double): String = String.format(Language.locale, "%.1f", value)
    private fun one(value: Double): String = String.format(Language.locale, "%.1f", value)
    private fun two(value: Double): String = String.format(Language.locale, "%.2f", value)

    private fun median(values: List<Long>): Long {
        if (values.isEmpty()) return 0
        val sorted = values.sorted()
        val mid = sorted.size / 2
        return if (sorted.size % 2 == 0) (sorted[mid - 1] + sorted[mid]) / 2 else sorted[mid]
    }

    private fun mean(values: List<Double>): Double = if (values.isEmpty()) 0.0 else values.sum() / values.size

    private fun engagementOf(video: Video): Double =
        if (video.views <= 0) 0.0 else (video.likes + video.comments + video.shares + video.saves).toDouble() / video.views * 100

    private fun localParts(unixSeconds: Long): Pair<Int, Int> {
        val date = Instant.ofEpochSecond(unixSeconds).atZone(ZoneId.systemDefault())
        return date.dayOfWeek.value to date.hour
    }

    private fun summarize(video: Video, medianViews: Long) = VideoSummary(
        id = video.id,
        url = video.url,
        desc = video.desc,
        views = video.views,
        likes = video.likes,
        createdAt = video.createdAt,
        durationSec = video.durationSec,
        engagementRate = engagementOf(video),
        multiple = if (medianViews > 0) video.views.toDouble() / medianViews else 0.0,
    )

    private fun empty(profile: Profile) = Metrics(
        hasData = false,
        sampleSize = 0,
        score = null,
        engagementRate = null,
        likeRate = 0.0,
        commentRate = 0.0,
        shareRate = 0.0,
        saveRate = 0.0,
        avgViews = 0,
        medianViews = 0,
        totalViews = 0,
        viewsPerFollower = null,
        postsPerWeek = null,
        avgDaysBetweenPosts = null,
        daysSinceLastPost = null,
        avgDuration = 0,
        bestSlots = emptyList(),
        durationBuckets = emptyList(),
        hashtags = emptyList(),
        topVideos = emptyList(),
        flopVideos = emptyList(),
        outlierCount = 0,
        bestMultiple = 0.0,
        avgDescLength = 0,
        questionShare = 0.0,
        emojiShare = 0.0,
        avgHashtags = 0.0,
        originalSoundShare = 0.0,
        insights = listOf(
            Insight(
                "info",
                tr("Noch keine Post-Daten", "No post data yet"),
                tr(
                    "Füge 5–30 Video-Links von @${profile.handle} hinzu, damit Engagement, beste Posting-Zeiten und Formate berechnet werden können.",
                    "Add 5–30 video links for @${profile.handle} so engagement, best posting times and formats can be calculated.",
                ),
            ),
        ),
    )

    fun compute(profile: Profile, videos: List<Video>): Metrics {
        val own = videos.filter { it.views > 0 }
        if (own.isEmpty()) return empty(profile)

        val sampleSize = own.size
        val totalViews = own.sumOf { it.views }
        val totalLikes = own.sumOf { it.likes }
        val totalComments = own.sumOf { it.comments }
        val totalShares = own.sumOf { it.shares }
        val totalSaves = own.sumOf { it.saves }

        val avgViews = totalViews / sampleSize
        val medianViews = median(own.map { it.views })
        val engagementRate = if (totalViews == 0L) 0.0 else (totalLikes + totalComments + totalShares + totalSaves).toDouble() / totalViews * 100
        val likeRate = if (totalViews == 0L) 0.0 else totalLikes.toDouble() / totalViews * 100
        val commentRate = if (totalViews == 0L) 0.0 else totalComments.toDouble() / totalViews * 100
        val shareRate = if (totalViews == 0L) 0.0 else totalShares.toDouble() / totalViews * 100
        val saveRate = if (totalViews == 0L) 0.0 else totalSaves.toDouble() / totalViews * 100
        val viewsPerFollower = if (profile.followers > 0) avgViews.toDouble() / profile.followers else 0.0

        val sortedByDate = own.sortedBy { it.createdAt }
        val gaps = (1 until sortedByDate.size).map { (sortedByDate[it].createdAt - sortedByDate[it - 1].createdAt) / 86_400.0 }
        val avgDaysBetweenPosts = if (gaps.isNotEmpty()) gaps.sum() / gaps.size else null
        val postsPerWeek = if (avgDaysBetweenPosts != null && avgDaysBetweenPosts > 0) 7 / avgDaysBetweenPosts else null
        val newest = sortedByDate.lastOrNull()
        val daysSinceLastPost = if (newest != null) (System.currentTimeMillis() / 1000.0 - newest.createdAt) / 86_400.0 else null
        val avgDuration = own.map { it.durationSec.toDouble() }.let { if (it.isEmpty()) 0 else (it.sum() / it.size).toInt() }

        val byViews = own.sortedByDescending { it.views }
        val topVideos = byViews.take(5).map { summarize(it, medianViews) }
        val topIds = topVideos.map { it.id }.toSet()
        val flopVideos = byViews.takeLast(3).reversed().filter { it.id !in topIds }.map { summarize(it, medianViews) }
        val outlierVideos = if (medianViews > 0) own.filter { it.views >= medianViews * 2 } else emptyList()
        val bestMultiple = topVideos.firstOrNull()?.multiple ?: 0.0

        val bucketsDef = listOf(
            "≤ 15 s" to (0 to 15),
            "16–30 s" to (16 to 30),
            "31–60 s" to (31 to 60),
            "61–180 s" to (61 to 180),
            "> 180 s" to (181 to Int.MAX_VALUE),
        )
        val durationBuckets = bucketsDef.map { (label, range) ->
            val inside = own.filter { it.durationSec in range.first..range.second }
            DurationBucket(
                label = label,
                posts = inside.size,
                avgViews = if (inside.isEmpty()) 0 else inside.sumOf { it.views } / inside.size,
            )
        }

        val tagMap = mutableMapOf<String, Pair<Int, Long>>()
        for (video in own) {
            for (tag in video.hashtags.map { it.lowercase() }.distinct()) {
                val current = tagMap[tag] ?: (0 to 0L)
                tagMap[tag] = (current.first + 1) to (current.second + video.views)
            }
        }
        val hashtags = tagMap.entries
            .map { HashtagStat(it.key, it.value.first, it.value.second / it.value.first) }
            .sortedByDescending { it.posts }
            .take(12)

        val emojiRegex = Regex("[\\uD83C-\\uDBFF\\uDC00-\\uDFFF]")
        val avgDescLength = own.map { it.desc.length }.let { it.sum() / it.size }
        val questionShare = own.count { it.desc.contains("?") }.toDouble() / sampleSize * 100
        val emojiShare = own.count { emojiRegex.containsMatchIn(it.desc) }.toDouble() / sampleSize * 100
        val avgHashtags = own.map { it.hashtags.size.toDouble() }.let { it.sum() / it.size }
        val originalSoundShare = own.count { it.originalSound }.toDouble() / sampleSize * 100

        val slots = own.groupBy { localParts(it.createdAt) }
            .map { (parts, group) ->
                Slot(parts.first, parts.second, group.sumOf { it.views } / group.size, group.size)
            }
            .sortedByDescending { it.avgViews }
        val weekdayPerf = own.groupBy { localParts(it.createdAt).first }
            .map { (weekday, group) -> Slot(weekday, 0, group.sumOf { it.views } / group.size, group.size) }
            .sortedByDescending { it.avgViews }

        val score = computeScore(
            engagementRate = engagementRate,
            viewsPerFollower = viewsPerFollower,
            postsPerWeek = postsPerWeek,
            daysSinceLastPost = daysSinceLastPost,
            outlierShare = outlierVideos.size.toDouble() / sampleSize,
            bestMultiple = bestMultiple,
        )

        val insights = mutableListOf<Insight>()

        if (weekdayPerf.isNotEmpty()) {
            val best = weekdayPerf.first()
            val bestSlot = slots.firstOrNull()
            insights.add(
                Insight(
                    "info",
                    tr("Bestes Zeitfenster", "Best time window"),
                    tr(
                        "Deine stärksten Posts laufen ${weekdayNames[best.weekday - 1]} (Ø ${fmt(best.avgViews)} Views)." +
                            (bestSlot?.let {
                                " Bestes Einzel-Zeitfenster: ${weekdayNames[it.weekday - 1]} um ${it.hour}:00 Uhr – Ø ${fmt(it.avgViews)} Views aus ${it.posts} ${if (it.posts == 1) "Post" else "Posts"}."
                            } ?: ""),
                        "Your strongest posts run on ${weekdayNames[best.weekday - 1]} (Ø ${fmt(best.avgViews)} views)." +
                            (bestSlot?.let {
                                " Best single window: ${weekdayNames[it.weekday - 1]} at ${it.hour}:00, Ø ${fmt(it.avgViews)} views from ${it.posts} post${if (it.posts == 1) "" else "s"}."
                            } ?: ""),
                    ),
                ),
            )
        }

        val erVerdict = tr(
            when {
                engagementRate >= 8 -> "sehr stark"
                engagementRate >= 4.5 -> "solide"
                engagementRate >= 2 -> "ausbaufähig"
                else -> "kritisch niedrig"
            },
            when {
                engagementRate >= 8 -> "very strong"
                engagementRate >= 4.5 -> "solid"
                engagementRate >= 2 -> "room to grow"
                else -> "critically low"
            },
        )
        insights.add(
            Insight(
                if (engagementRate >= 4.5) "good" else "warn",
                tr("Engagement-Rate ${pct(engagementRate)} % – $erVerdict", "Engagement rate ${pct(engagementRate)}% – $erVerdict"),
                tr(
                    "Likes ${pct(likeRate)} % · Kommentare ${pct(commentRate)} % · Shares ${pct(shareRate)} % · Saves ${pct(saveRate)} % (Benchmark: 4,5 % gesamt). Shares und Saves sind 2026 die stärksten Reichweiten-Signale – hier lohnt Optimierung am meisten.",
                    "Likes ${pct(likeRate)}% · comments ${pct(commentRate)}% · shares ${pct(shareRate)}% · saves ${pct(saveRate)}% (benchmark: 4.5% overall). Shares and saves are the strongest reach signals in 2026, so this is where tuning pays off most.",
                ),
            ),
        )

        val reachVerdict = tr(
            when {
                viewsPerFollower >= 2 -> "Du hast echte Reichweite über deine Follower hinaus."
                viewsPerFollower >= 1 -> "Solide – der For You Feed greift."
                else -> "Deine Videos laufen vor allem im eigenen Follower-Kreis."
            },
            when {
                viewsPerFollower >= 2 -> "You reach well beyond your own followers."
                viewsPerFollower >= 1 -> "Solid – the For You feed is picking it up."
                else -> "Your videos mostly run inside your own follower circle."
            },
        )
        insights.add(
            Insight(
                if (viewsPerFollower >= 1) "good" else "warn",
                tr("${two(viewsPerFollower)} Views pro Follower", "${two(viewsPerFollower)} views per follower"),
                tr(
                    "Ø ${fmt(avgViews)} Views bei ${fmt(profile.followers)} Followern. $reachVerdict",
                    "Ø ${fmt(avgViews)} views with ${fmt(profile.followers)} followers. $reachVerdict",
                ),
            ),
        )

        if (postsPerWeek != null && avgDaysBetweenPosts != null) {
            val pause = (daysSinceLastPost ?: 0.0) > 14
            insights.add(
                Insight(
                    if (pause) "warn" else if (postsPerWeek >= 2) "good" else "info",
                    tr("Rhythmus: ${one(postsPerWeek)} Posts/Woche", "Cadence: ${one(postsPerWeek)} posts/week"),
                    tr(
                        "Ø alle ${one(avgDaysBetweenPosts)} Tage ein Post. " +
                            (daysSinceLastPost?.let { "Letzter Post vor ${it.toInt()} Tagen. " } ?: "") +
                            (if (pause) "Lange Pausen kosten Reichweite – plane lieber kleine, regelmäßige Uploads." else ""),
                        "One post every ${one(avgDaysBetweenPosts)} days on average. " +
                            (daysSinceLastPost?.let { "Last post ${it.toInt()} days ago. " } ?: "") +
                            (if (pause) "Long breaks cost reach, so plan small, regular uploads instead." else ""),
                    ),
                ),
            )
        }

        if (medianViews > 0) {
            insights.add(
                Insight(
                    if (outlierVideos.isNotEmpty()) "good" else "info",
                    tr(
                        "${outlierVideos.size} von $sampleSize Videos laufen überdurchschnittlich",
                        "${outlierVideos.size} of $sampleSize videos beat the average",
                    ),
                    tr(
                        "Dein bestes Video läuft ${one(bestMultiple)}× so gut wie der Median (${fmt(medianViews)} Views). Analysiere genau diese Videos und baue Serien daraus.",
                        "Your best video does ${one(bestMultiple)}× the median (${fmt(medianViews)} views). Study exactly those videos and turn them into series.",
                    ),
                ),
            )
        }

        val bestBucket = durationBuckets.filter { it.posts > 0 }.maxByOrNull { it.avgViews }
        if (bestBucket != null) {
            insights.add(
                Insight(
                    "info",
                    tr("Längen-Fenster: ${bestBucket.label}", "Length window: ${bestBucket.label}"),
                    tr(
                        "In diesem Fenster holst du Ø ${fmt(bestBucket.avgViews)} Views (${bestBucket.posts} Videos). Videos unter 3 Sekunden Hook-Retention verlieren – prüfe bei Flops die ersten 2 Sekunden.",
                        "This window brings Ø ${fmt(bestBucket.avgViews)} views (${bestBucket.posts} videos). Videos that lose hook retention under 3 seconds drop off, so check the first 2 seconds of every flop.",
                    ),
                ),
            )
        }

        hashtags.firstOrNull()?.let { topTag ->
            insights.add(
                Insight(
                    "info",
                    tr("Hashtag-Nutzung", "Hashtag usage"),
                    tr(
                        "Am häufigsten: #${topTag.tag} (${topTag.posts}×, Ø ${fmt(topTag.avgViews)} Views). Ø ${one(avgHashtags)} Hashtags pro Video – 3 bis 5 passende Tags (Nische + Reichweite) reichen.",
                        "Most used: #${topTag.tag} (${topTag.posts}×, Ø ${fmt(topTag.avgViews)} views). Ø ${one(avgHashtags)} hashtags per video; 3 to 5 fitting tags (niche plus reach) are enough.",
                    ),
                ),
            )
        }

        insights.add(
            Insight(
                if (originalSoundShare >= 50) "good" else "info",
                "Sound & Hook",
                tr(
                    "Ø Beschreibung $avgDescLength Zeichen, ${questionShare.toInt()} % der Captions stellen eine Frage, ${emojiShare.toInt()} % nutzen Emojis, ${originalSoundShare.toInt()} % Originalton. " +
                        (if (originalSoundShare >= 50) "Originalton ist gut für Wiedererkennung." else "Trend-Sounds können die Reichweite kurzfristig deutlich erhöhen."),
                    "Ø caption length $avgDescLength characters, ${questionShare.toInt()}% of captions ask a question, ${emojiShare.toInt()}% use emojis, ${originalSoundShare.toInt()}% original sound. " +
                        (if (originalSoundShare >= 50) "Original sound helps recognition." else "Trend sounds can lift reach noticeably for a short time."),
                ),
            ),
        )

        return Metrics(
            hasData = true,
            sampleSize = sampleSize,
            score = score,
            engagementRate = engagementRate,
            likeRate = likeRate,
            commentRate = commentRate,
            shareRate = shareRate,
            saveRate = saveRate,
            avgViews = avgViews,
            medianViews = medianViews,
            totalViews = totalViews,
            viewsPerFollower = viewsPerFollower,
            postsPerWeek = postsPerWeek,
            avgDaysBetweenPosts = avgDaysBetweenPosts,
            daysSinceLastPost = daysSinceLastPost,
            avgDuration = avgDuration,
            bestSlots = slots.take(6),
            durationBuckets = durationBuckets,
            hashtags = hashtags,
            topVideos = topVideos,
            flopVideos = flopVideos,
            outlierCount = outlierVideos.size,
            bestMultiple = bestMultiple,
            avgDescLength = avgDescLength,
            questionShare = questionShare,
            emojiShare = emojiShare,
            avgHashtags = avgHashtags,
            originalSoundShare = originalSoundShare,
            insights = insights,
        )
    }

    private fun computeScore(
        engagementRate: Double,
        viewsPerFollower: Double,
        postsPerWeek: Double?,
        daysSinceLastPost: Double?,
        outlierShare: Double,
        bestMultiple: Double,
    ): Int {
        val er = engagementRate
        val engagement = when {
            er >= 8 -> 30
            er >= 6 -> 26
            er >= 4.5 -> 21
            er >= 3 -> 15
            er >= 1.5 -> 9
            else -> 4
        }
        val vpf = viewsPerFollower
        val reach = when {
            vpf >= 3 -> 25
            vpf >= 2 -> 22
            vpf >= 1 -> 17
            vpf >= 0.5 -> 11
            vpf >= 0.2 -> 7
            else -> 2
        }
        val pfw = postsPerWeek ?: 0.0
        var consistency = when {
            pfw >= 5 -> 25
            pfw >= 3 -> 21
            pfw >= 2 -> 16
            pfw >= 1 -> 11
            pfw >= 0.5 -> 7
            else -> 2
        }
        val pause = daysSinceLastPost ?: 0.0
        if (pause > 21) consistency -= 8 else if (pause > 14) consistency -= 4

        var virality = when {
            outlierShare >= 0.3 -> 20
            outlierShare >= 0.2 -> 16
            outlierShare >= 0.1 -> 11
            outlierShare > 0 -> 6
            else -> 1
        }
        if (bestMultiple >= 5) virality += 2

        val total = engagement + reach + consistency.coerceAtLeast(0) + virality.coerceAtMost(20)
        return total.coerceIn(0, 100)
    }
}
