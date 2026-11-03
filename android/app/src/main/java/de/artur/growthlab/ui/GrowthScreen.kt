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
import de.artur.growthlab.data.Snapshot
import de.artur.growthlab.data.TikTok
import de.artur.growthlab.data.TrackedAccount
import de.artur.growthlab.data.deltaAll
import de.artur.growthlab.data.first
import de.artur.growthlab.data.latest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

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
        ScreenTitle("Wachstums-Tracking", "Jeder Scan und jede Messung erzeugt einen Punkt im Verlauf.")

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = handle,
                onValueChange = { handle = it },
                label = { Text("@account hinzufügen") },
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
                Text("Hinzufügen")
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
            Text(if (state.busy) "Messe…" else "Alle messen")
        }

        addError?.let { Text(it, color = Pink, fontSize = 12.sp) }

        if (state.accounts.isEmpty()) {
            CardBox {
                Text("Noch keine Accounts", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text("Trage oben einen TikTok-Namen ein – oder scanne im Tab „Scan“ mit aktivem Tracking.", fontSize = 12.sp, color = MutedColor)
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

@Composable
private fun AccountCard(account: TrackedAccount, open: Boolean, onToggle: () -> Unit, onRemove: () -> Unit) {
    val latest = account.latest()
    val delta = account.deltaAll()

    CardBox {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("@${account.handle}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    account.nickname + " · " + (latest?.let { "${it.videos} Videos" } ?: "keine Messung"),
                    fontSize = 11.sp,
                    color = MutedColor,
                )
            }
            Text(if (latest != null) num(latest.followers) else "–", fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiTile("Gesamt", if (delta == null) "–" else if (delta >= 0) "+${num(delta)}" else num(delta), "${account.snapshots.size} Messpunkte", Modifier.weight(1f))
            KpiTile("Likes", latest?.let { num(it.hearts) } ?: "–", null, Modifier.weight(1f))
            KpiTile("Score", latest?.score?.let { "$it/100" } ?: "–", null, Modifier.weight(1f))
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onToggle) { Text(if (open) "Werte schließen" else "Werte im Detail") }
            TextButton(onClick = onRemove) { Text("entfernen", color = MutedColor) }
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
        KpiTile("Follower", latest?.let { num(it.followers) } ?: "–", null, Modifier.weight(1f))
        KpiTile("Folgt selbst", latest?.let { num(it.following) } ?: "–", null, Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        KpiTile("Engagement", latest?.engagementRate?.let { "${dec(it)} %" } ?: "–", null, Modifier.weight(1f))
        KpiTile("Likes gesamt", latest?.let { num(it.hearts) } ?: "–", null, Modifier.weight(1f))
    }

    if (snapshots.size < 2) {
        Text(
            "Eine Kurve entsteht ab zwei Messpunkten – klicke nach deinem nächsten Upload auf „Alle messen“.",
            fontSize = 11.sp,
            color = MutedColor,
        )
    }

    Text("Messungen", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
    snapshots.reversed().take(12).forEachIndexed { index, snapshot ->
        val previous = snapshots.reversed().getOrNull(index + 1)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(dateShort(snapshot.at), fontSize = 11.sp, color = MutedColor)
            Text(
                buildString {
                    append(num(snapshot.followers))
                    append(" Follower")
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
            "Letzte Messung: ${dateShort(latest.at)}",
            fontSize = 10.sp,
            color = MutedColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}
