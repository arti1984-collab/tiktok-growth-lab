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
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.artur.growthlab.LabState
import de.artur.growthlab.data.Metrics
import de.artur.growthlab.data.ScanResult
import de.artur.growthlab.data.TikTok
import de.artur.growthlab.data.TikTokException
import de.artur.growthlab.data.VideoSummary
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
        ScreenTitle("Account scannen", "Liest Profil und Video-Performance direkt von tiktok.com – ohne Login.")

        OutlinedTextField(
            value = handle,
            onValueChange = { handle = it },
            label = { Text("TikTok-Name oder Profil-Link") },
            placeholder = { Text("@arti1984po") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = links,
            onValueChange = { links = it },
            label = { Text("Video-Links (ein Link pro Zeile)") },
            placeholder = { Text("https://www.tiktok.com/@name/video/123…") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "TikTok gibt die Post-Liste ohne Login nicht heraus. Profil-Zahlen kommen immer; für Engagement, beste Zeiten und Top-Videos 5–40 Video-Links einfügen.",
            fontSize = 11.sp,
            color = MutedColor,
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = track, onCheckedChange = { track = it })
            Spacer(Modifier.width(10.dp))
            Text("In Wachstums-Tracking aufnehmen", fontSize = 13.sp)
        }

        Button(
            onClick = {
                scope.launch {
                    state.busy = true
                    state.error = null
                    state.progress = "Profil wird gelesen…"
                    try {
                        val list = links.split('\n', ',', ' ').map { it.trim() }.filter { it.isNotEmpty() }
                        val result = TikTok.scan(handle, list) { done, total -> state.progress = "$done von $total Videos" }
                        state.scan = result
                        if (track) state.track(result.profile, result.metrics)
                        state.progress = ""
                    } catch (error: Exception) {
                        val hint = (error as? TikTokException)?.hint.orEmpty()
                        state.error = (error.message ?: "Unbekannter Fehler") + if (hint.isNotBlank()) "\n$hint" else ""
                    } finally {
                        state.busy = false
                    }
                }
            },
            enabled = !state.busy && handle.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.busy) "Analysiere…" else "Jetzt analysieren", fontWeight = FontWeight.SemiBold)
        }

        if (state.busy) {
            LinearProgressIndicator(Modifier.fillMaxWidth())
            Text(state.progress, fontSize = 11.sp, color = MutedColor)
        }

        state.error?.let { message ->
            CardBox {
                Text("Das hat nicht geklappt", color = Danger, fontWeight = FontWeight.Bold, fontSize = 14.sp)
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
            if (profile.verified) Pill("verifiziert", GoodColor)
        }
        if (profile.bio.isNotBlank()) Text(profile.bio, fontSize = 12.sp, color = MutedColor)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiTile("Follower", num(profile.followers), modifier = Modifier.weight(1f))
            KpiTile("Likes", num(profile.hearts), modifier = Modifier.weight(1f))
            KpiTile("Videos", num(profile.videos), modifier = Modifier.weight(1f))
        }
    }

    if (metrics.hasData) {
        ScoreCard(metrics)

        CardBox {
            Text("Beste Zeitfenster", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            metrics.bestSlots.take(4).forEach { slot ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${MetricsEngineWeekday(slot.weekday)} ${slot.hour}:00", fontSize = 13.sp)
                    Text("Ø ${num(slot.avgViews)} Views · ${slot.posts}×", fontSize = 12.sp, color = MutedColor)
                }
            }
        }

        CardBox {
            Text("Top-Videos", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            metrics.topVideos.forEach { video -> VideoRow(video) }
        }

        CardBox {
            Text("Was die Zahlen bedeuten", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            metrics.insights.forEach { insight -> InsightRow(insight.kind, insight.title, insight.text) }
        }
    } else {
        CardBox {
            Text("Nur Profil-Zahlen", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(
                "Für Engagement, Score und beste Zeiten fehlen Video-Links. Kopiere in TikTok ein Video → Teilen → Link kopieren und füge 5–40 Links ein.",
                fontSize = 12.sp,
                color = MutedColor,
            )
        }
    }

    if (scan.warnings.isNotEmpty()) {
        CardBox {
            Text("Hinweise", fontWeight = FontWeight.Bold, fontSize = 14.sp)
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
            KpiTile("Engagement", "${dec(metrics.engagementRate ?: 0.0)} %", "${metrics.sampleSize} Videos", Modifier.weight(1f))
            KpiTile("Ø Views", num(metrics.avgViews), "Median ${num(metrics.medianViews)}", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiTile("Views/Follower", dec(metrics.viewsPerFollower ?: 0.0, 2), null, Modifier.weight(1f))
            KpiTile("Rhythmus", "${dec(metrics.postsPerWeek ?: 0.0)}/Woche", "Ø ${num(metrics.avgDuration.toLong())} s", Modifier.weight(1f))
        }
    }
}

@Composable
private fun VideoRow(video: VideoSummary) {
    Column(Modifier.fillMaxWidth()) {
        Text(video.desc.take(80).ifBlank { "(ohne Caption)" }, fontSize = 13.sp, maxLines = 2)
        Text(
            "${num(video.views)} Views · ${num(video.likes)} Likes · ${dec(video.engagementRate)} % · ${video.durationSec}s · ${dateOnly(video.createdAt * 1000)}",
            fontSize = 11.sp,
            color = MutedColor,
        )
    }
}

private fun MetricsEngineWeekday(weekday: Int): String =
    de.artur.growthlab.data.MetricsEngine.weekdayNames.getOrElse(weekday - 1) { "?" }
