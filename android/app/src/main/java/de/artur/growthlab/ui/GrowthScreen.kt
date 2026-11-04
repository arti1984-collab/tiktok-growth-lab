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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import de.artur.growthlab.data.PlanItem
import de.artur.growthlab.data.Snapshot
import de.artur.growthlab.data.TikTok
import de.artur.growthlab.data.TrackedAccount
import de.artur.growthlab.data.deltaAll
import de.artur.growthlab.data.weekdayName
import de.artur.growthlab.data.first
import de.artur.growthlab.data.latest
import de.artur.growthlab.data.tr
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

@Composable
fun GrowthScreen(state: LabState) {
    val scope = rememberCoroutineScope()
    var handle by remember { mutableStateOf("") }
    var addError by remember { mutableStateOf<String?>(null) }
    var expanded by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenTitle(
            tr("Wachstums-Tracking", "Growth tracking"),
            tr("Jeder Scan und jede Messung erzeugt einen Punkt im Verlauf.", "Every scan and every refresh adds a point to the history."),
        )

        PlanCard(state)

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = handle,
                onValueChange = { handle = it },
                label = { Text(tr("@account hinzufügen", "add @account")) },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            Button(
                onClick = {
                    scope.launch {
                        state.busy = true
                        addError = null
                        try {
                            val profile = TikTok.getProfile(handle)
                            state.track(profile, null)
                            handle = ""
                        } catch (error: Exception) {
                            addError = error.message
                        } finally {
                            state.busy = false
                        }
                    }
                },
                enabled = !state.busy && handle.isNotBlank(),
            ) {
                Text(tr("Hinzufügen", "Add"))
            }
        }

        Button(
            onClick = {
                scope.launch {
                    state.busy = true
                    for (account in state.accounts.toList()) {
                        try {
                            val profile = TikTok.getProfile(account.handle)
                            state.track(profile, null)
                        } catch (error: Exception) {
                            addError = "@${account.handle}: ${error.message}"
                        }
                        delay(900)
                    }
                    state.busy = false
                }
            },
            enabled = !state.busy && state.accounts.isNotEmpty(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.busy) tr("Messe…", "Measuring…") else tr("Alle messen", "Measure all"))
        }

        addError?.let { Text(it, color = Danger, fontSize = 12.sp) }

        if (state.accounts.isEmpty()) {
            CardBox {
                Text(tr("Noch keine Accounts", "No accounts yet"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(
                    tr(
                        "Trage oben einen TikTok-Namen ein – oder scanne im Tab „Scan“ mit aktivem Tracking.",
                        "Add a TikTok name above, or scan in the Scan tab with tracking switched on.",
                    ),
                    fontSize = 12.sp,
                    color = MutedColor,
                )
            }
        }

        state.accounts.forEach { account ->
            AccountCard(
                account = account,
                open = expanded == account.handle,
                onToggle = { expanded = if (expanded == account.handle) null else account.handle },
                onRemove = { state.remove(account.handle) },
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

/* ------------------------------------------------------------- Wochenplan */

private fun isoDate(calendar: Calendar): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)

/** Wochentag 1 bis 7 (Montag zuerst) auf den nächsten passenden Tag legen. */
private fun nextDateFor(weekday: Int): String {
    val today = Calendar.getInstance()
    val current = ((today.get(Calendar.DAY_OF_WEEK) + 5) % 7) + 1
    var diff = (weekday - current + 7) % 7
    if (diff == 0) diff = 7
    today.add(Calendar.DAY_OF_MONTH, diff)
    return isoDate(today)
}

private fun videoIdFromUrl(url: String): String? =
    Regex("/video/(\\d{6,})").find(url)?.groupValues?.getOrNull(1)

@Composable
private fun PlanCard(state: LabState) {
    val slots = state.scan?.metrics?.bestSlots ?: emptyList()
    val median = state.scan?.metrics?.medianViews ?: 0L
    val planned = state.plan.count { it.status == "planned" }
    val done = state.plan.count { it.status == "done" }

    fun suggested(): List<PlanItem> {
        val picked = mutableListOf<Pair<Int, Int>>()
        for (slot in slots) {
            if (picked.size >= 3) break
            if (picked.any { it.first == slot.weekday }) continue
            picked.add(slot.weekday to slot.hour)
        }
        if (picked.isEmpty()) {
            val tomorrow = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, 1) }
            val dayAfter = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, 2) }
            return listOf(isoDate(tomorrow), isoDate(dayAfter)).map { date ->
                PlanItem(id = UUID.randomUUID().toString(), date = date, time = "19:00")
            }
        }
        return picked.map { (weekday, hour) ->
            PlanItem(
                id = UUID.randomUUID().toString(),
                date = nextDateFor(weekday),
                time = String.format(Locale.US, "%02d:00", hour),
            )
        }
    }

    CardBox {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(tr("Wochenplan", "Weekly plan"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            if (state.plan.isNotEmpty()) {
                Text("$planned ${tr("offen", "open")} · $done ${tr("gepostet", "posted")}", fontSize = 10.sp, color = MutedColor)
            }
        }
        Text(
            tr(
                "Termine aus den besten Zeiten. Nach dem Posten die Video-URL eintragen, dann steht die Zahl daneben.",
                "Dates from your best times. Paste the video URL after posting and the number appears next to it.",
            ),
            fontSize = 11.sp,
            color = MutedColor,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { state.addPlan(suggested()) }, enabled = !state.busy) {
                Text(
                    if (slots.isEmpty()) tr("2 Abende planen", "Plan 2 evenings")
                    else tr("3 Termine übernehmen", "Take 3 slots"),
                    fontSize = 12.sp,
                )
            }
            TextButton(
                onClick = {
                    val tomorrow = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, 1) }
                    state.addPlan(
                        listOf(PlanItem(id = UUID.randomUUID().toString(), date = isoDate(tomorrow), time = "19:00")),
                    )
                },
            ) {
                Text(tr("+ Termin", "+ Slot"), fontSize = 12.sp)
            }
        }

        if (state.plan.isEmpty()) {
            Text(
                tr(
                    "Noch nichts geplant. Ein Scan liefert die drei stärksten Zeiten, ohne Scan nimmt der Plan zwei Abende vor.",
                    "Nothing planned yet. A scan finds your three strongest times, without one the plan suggests two evenings.",
                ),
                fontSize = 11.sp,
                color = MutedColor,
            )
        }

        state.plan.forEach { item ->
            var note by remember(item.id) { mutableStateOf(item.note) }
            var url by remember(item.id) { mutableStateOf(item.videoUrl) }
            val date = runCatching {
                Calendar.getInstance().apply { time = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(item.date) ?: time }
            }.getOrNull()
            val weekday = date?.let { ((it.get(Calendar.DAY_OF_WEEK) + 5) % 7) + 1 }
            val video = videoIdFromUrl(item.videoUrl)?.let { id -> state.scan?.videos?.firstOrNull { it.id == id } }

            DividerLine()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    buildString {
                        append(item.time)
                        append("  ")
                        append(item.date)
                        weekday?.let { append(" · "); append(weekdayName(it)) }
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (item.status == "done") MutedColor else InkColor,
                )
                Row { TextButton(onClick = { state.removePlan(item.id) }) { Text("✕", color = MutedColor, fontSize = 12.sp) } }
            }
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text(tr("Idee oder Hook", "Idea or hook"), fontSize = 11.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            if (note != item.note) {
                TextButton(onClick = { state.updatePlan(item.copy(note = note)) }) {
                    Text(tr("Idee speichern", "Save idea"), fontSize = 11.sp)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { state.updatePlan(item.copy(status = if (item.status == "done") "planned" else "done")) },
                ) {
                    Text(
                        if (item.status == "done") tr("wieder offen", "reopen") else tr("gepostet", "posted"),
                        fontSize = 12.sp,
                    )
                }
            }
            if (item.status == "done") {
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text(tr("Video-URL", "Video URL"), fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (url != item.videoUrl) {
                    TextButton(onClick = { state.updatePlan(item.copy(videoUrl = url.trim())) }) {
                        Text(tr("URL speichern", "Save URL"), fontSize = 11.sp)
                    }
                }
                Text(
                    if (video != null) {
                        tr(
                            "${num(video.views)} Views, ${if (median > 0) dec(video.views.toDouble() / median * 100) else "–"} % des Medians",
                            "${num(video.views)} views, ${if (median > 0) dec(video.views.toDouble() / median * 100) else "–"}% of the median",
                        )
                    } else {
                        tr(
                            "Noch nicht im letzten Scan, der Vergleich kommt mit dem nächsten.",
                            "Not in the last scan yet, the comparison follows with the next one.",
                        )
                    },
                    fontSize = 10.sp,
                    color = MutedColor,
                )
            }
        }
    }
}

@Composable
private fun AccountCard(account: TrackedAccount, open: Boolean, onToggle: () -> Unit, onRemove: () -> Unit) {
    val latest = account.latest()
    val delta = account.deltaAll()

    CardBox {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("@${account.handle}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    account.nickname + " · " + (
                        latest?.let { "${it.videos} ${tr("Videos", "videos")}" }
                            ?: tr("keine Messung", "no measurement")
                        ),
                    fontSize = 11.sp,
                    color = MutedColor,
                )
            }
            Text(if (latest != null) num(latest.followers) else "–", fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiTile(
                tr("Gesamt", "Total"),
                if (delta == null) "–" else if (delta >= 0) "+${num(delta)}" else num(delta),
                "${account.snapshots.size} ${tr("Messpunkte", "measurements")}",
                Modifier.weight(1f),
            )
            KpiTile("Likes", latest?.let { num(it.hearts) } ?: "–", null, Modifier.weight(1f))
            KpiTile("Score", latest?.score?.let { "$it/100" } ?: "–", null, Modifier.weight(1f))
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onToggle) { Text(if (open) tr("Werte schließen", "Hide values") else tr("Werte im Detail", "Values in detail")) }
            TextButton(onClick = onRemove) { Text(tr("entfernen", "remove"), color = MutedColor) }
        }

        if (open) {
            DetailValues(account)
        }
    }
}

@Composable
private fun DetailValues(account: TrackedAccount) {
    val snapshots = account.snapshots
    val latest = snapshots.lastOrNull()

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        KpiTile(tr("Follower", "Followers"), latest?.let { num(it.followers) } ?: "–", null, Modifier.weight(1f))
        KpiTile(tr("Folgt selbst", "Following"), latest?.let { num(it.following) } ?: "–", null, Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        KpiTile("Engagement", latest?.engagementRate?.let { "${dec(it)} %" } ?: "–", null, Modifier.weight(1f))
        KpiTile(tr("Likes gesamt", "Likes total"), latest?.let { num(it.hearts) } ?: "–", null, Modifier.weight(1f))
    }

    if (snapshots.size < 2) {
        Text(
            tr(
                "Eine Kurve entsteht ab zwei Messpunkten – klicke nach deinem nächsten Upload auf „Alle messen“.",
                "A curve starts with two measurements, so press \"Measure all\" after your next upload.",
            ),
            fontSize = 11.sp,
            color = MutedColor,
        )
    }

    Text(tr("Messungen", "Measurements"), fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
    snapshots.reversed().take(12).forEachIndexed { index, snapshot ->
        val previous = snapshots.reversed().getOrNull(index + 1)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(dateShort(snapshot.at), fontSize = 11.sp, color = MutedColor)
            Text(
                buildString {
                    append(num(snapshot.followers))
                    append(" ")
                    append(tr("Follower", "followers"))
                    if (previous != null) {
                        val diff = snapshot.followers - previous.followers
                        append(" · ")
                        append(if (diff >= 0) "+$diff" else "$diff")
                    }
                    snapshot.engagementRate?.let { append(" · ${dec(it)} %") }
                },
                fontSize = 11.sp,
            )
        }
    }
    SnapshotNote(latest)
}

@Composable
private fun SnapshotNote(latest: Snapshot?) {
    if (latest == null) return
    Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
        Text(
            tr("Letzte Messung: ${dateShort(latest.at)}", "Last measurement: ${dateShort(latest.at)}"),
            fontSize = 10.sp,
            color = MutedColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}
