package de.artur.growthlab.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.artur.growthlab.LabState
import de.artur.growthlab.data.Metrics
import de.artur.growthlab.data.ScanResult
import de.artur.growthlab.data.TikTok
import de.artur.growthlab.data.TikTokException
import de.artur.growthlab.data.VideoSummary
import de.artur.growthlab.data.tr
import de.artur.growthlab.data.weekdayName
import kotlinx.coroutines.launch

@Composable
fun ScanScreen(state: LabState) {
    val scope = rememberCoroutineScope()
    var handle by remember { mutableStateOf("") }
    var links by remember { mutableStateOf("") }
    var track by remember { mutableStateOf(true) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenTitle(
            tr("Account scannen", "Scan an account"),
            tr(
                "Liest Profil und Video-Performance direkt von tiktok.com – ohne Login.",
                "Reads the profile and video performance straight from tiktok.com, no login.",
            ),
        )

        OutlinedTextField(
            value = handle,
            onValueChange = { handle = it },
            label = { Text(tr("TikTok-Name oder Profil-Link", "TikTok name or profile link")) },
            placeholder = { Text("@testkonto") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = links,
            onValueChange = { links = it },
            label = { Text(tr("Video-Links (ein Link pro Zeile)", "Video links (one per line)")) },
            placeholder = { Text("https://www.tiktok.com/@name/video/123…") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            tr(
                "Die neuesten 15 Videos liest der Scan selbst von TikTok, mit Views, Likes und Uhrzeiten. Für ältere Videos Links einfügen, einen pro Zeile.",
                "The scan reads the newest 15 videos from TikTok itself, with views, likes and times. For older videos add links, one per line.",
            ),
            fontSize = 11.sp,
            color = MutedColor,
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = track, onCheckedChange = { track = it })
            Spacer(Modifier.width(10.dp))
            Text(tr("In Wachstums-Tracking aufnehmen", "Add to growth tracking"), fontSize = 13.sp)
        }

        Button(
            onClick = {
                scope.launch {
                    state.busy = true
                    state.error = null
                    state.progress = tr("Profil wird gelesen…", "Reading the profile…")
                    try {
                        val list = links.split('\n', ',', ' ').map { it.trim() }.filter { it.isNotEmpty() }
                        val result = TikTok.scan(handle, list) { done, total ->
                            state.progress = tr("$done von $total Videos", "$done of $total videos")
                        }
                        state.scan = result
                        if (track) state.track(result.profile, result.metrics)
                        state.progress = ""
                    } catch (error: Exception) {
                        val hint = (error as? TikTokException)?.hint.orEmpty()
                        state.error = (error.message ?: tr("Unbekannter Fehler", "Unknown error")) + if (hint.isNotBlank()) "\n$hint" else ""
                    } finally {
                        state.busy = false
                    }
                }
            },
            enabled = !state.busy && handle.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.busy) tr("Analysiere…", "Analysing…") else tr("Jetzt analysieren", "Analyse now"), fontWeight = FontWeight.SemiBold)
        }

        if (state.busy) {
            LinearProgressIndicator(Modifier.fillMaxWidth())
            Text(state.progress, fontSize = 11.sp, color = MutedColor)
        }

        state.error?.let { message ->
            CardBox {
                Text(tr("Das hat nicht geklappt", "That did not work"), color = Danger, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(message, fontSize = 12.sp, color = MutedColor)
            }
        }

        state.scan?.let { result -> ScanResultView(result) }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ScanResultView(scan: ScanResult) {
    val profile = scan.profile
    val metrics = scan.metrics

    CardBox {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("@${profile.handle}", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text(profile.nickname, fontSize = 12.sp, color = MutedColor)
            }
            if (profile.verified) Pill(tr("verifiziert", "verified"), GoodColor)
        }
        if (profile.bio.isNotBlank()) Text(profile.bio, fontSize = 12.sp, color = MutedColor)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiTile(tr("Follower", "Followers"), num(profile.followers), modifier = Modifier.weight(1f))
            KpiTile("Likes", num(profile.hearts), modifier = Modifier.weight(1f))
            KpiTile(tr("Videos", "Videos"), num(profile.videos), modifier = Modifier.weight(1f))
        }
    }

    if (metrics.hasData) {
        ScoreCard(metrics)

        CardBox {
            Text(tr("Beste Zeitfenster", "Best time windows"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            metrics.bestSlots.take(4).forEach { slot ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${weekdayName(slot.weekday - 1)} ${slot.hour}:00", fontSize = 13.sp)
                    Text("Ø ${num(slot.avgViews)} ${tr("Views", "views")} · ${slot.posts}×", fontSize = 12.sp, color = MutedColor)
                }
            }
        }

        CardBox {
            Text(tr("Top-Videos", "Top videos"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            metrics.topVideos.forEach { video -> VideoRow(video) }
        }

        CardBox {
            Text(tr("Was die Zahlen bedeuten", "What the numbers mean"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            metrics.insights.forEach { insight -> InsightRow(insight.kind, insight.title, insight.text) }
        }
    } else {
        CardBox {
            Text(tr("Nur Profil-Zahlen", "Profile numbers only"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(
                tr(
                    "TikTok hat keine Videos zurückgegeben. Bei einem privaten Konto bleibt es beim Profil, sonst starte den Scan später erneut.",
                    "TikTok returned no videos. A private account stays at the profile, otherwise run the scan again later.",
                ),
                fontSize = 12.sp,
                color = MutedColor,
            )
        }
    }

    if (scan.warnings.isNotEmpty()) {
        CardBox {
            Text(tr("Hinweise", "Notes"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            scan.warnings.forEach { warning -> Text("• $warning", fontSize = 11.sp, color = MutedColor) }
        }
    }
}

@Composable
private fun ScoreCard(metrics: Metrics) {
    CardBox {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Growth-Score", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Pill("${metrics.score ?: 0}/100", if ((metrics.score ?: 0) >= 60) GoodColor else WarnColor)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiTile("Engagement", "${dec(metrics.engagementRate ?: 0.0)} %", "${metrics.sampleSize} ${tr("Videos", "videos")}", Modifier.weight(1f))
            KpiTile(tr("Ø Views", "Ø views"), num(metrics.avgViews), "${tr("Median", "median")} ${num(metrics.medianViews)}", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiTile("Views/Follower", dec(metrics.viewsPerFollower ?: 0.0, 2), null, Modifier.weight(1f))
            KpiTile(
                tr("Rhythmus", "Cadence"),
                "${dec(metrics.postsPerWeek ?: 0.0)}/${tr("Woche", "week")}",
                "Ø ${num(metrics.avgDuration.toLong())} s",
                Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun VideoRow(video: VideoSummary) {
    Column(Modifier.fillMaxWidth()) {
        Text(video.desc.take(80).ifBlank { tr("(ohne Caption)", "(no caption)") }, fontSize = 13.sp, maxLines = 2)
        Text(
            "${num(video.views)} ${tr("Views", "views")} · ${num(video.likes)} Likes · ${dec(video.engagementRate)} % · ${video.durationSec}s · ${dateOnly(video.createdAt * 1000)}",
            fontSize = 11.sp,
            color = MutedColor,
        )
        Text(
            video.url.removePrefix("https://www.tiktok.com/"),
            fontSize = 10.sp,
            color = Accent,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
