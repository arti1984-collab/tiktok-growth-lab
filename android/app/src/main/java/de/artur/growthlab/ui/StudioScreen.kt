package de.artur.growthlab.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.artur.growthlab.LabState
import de.artur.growthlab.data.Ai
import de.artur.growthlab.data.Prompts
import de.artur.growthlab.data.TextExport
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun StudioScreen(state: LabState) {
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var mode by remember { mutableStateOf(Prompts.MODES.first().first) }
    var topic by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf<String?>(null) }
    var parsed by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var copied by remember { mutableStateOf(false) }
    var pendingText by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val fileSaver = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/plain")) { uri ->
        val payload = pendingText
        if (uri != null && payload != null) {
            runCatching { context.contentResolver.openOutputStream(uri)?.use { it.write(payload.toByteArray()) } }
            saved = true
        }
        pendingText = null
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ScreenTitle("KI-Studio", "Strategie, Hooks und Captions auf Basis deiner gescrapten Zahlen.")

        val scan = state.scan
        CardBox {
            Text(
                if (scan?.metrics?.hasData == true) {
                    "Mit echten Daten: @${scan.profile.handle} · ${scan.metrics.sampleSize} Videos · Score ${scan.metrics.score}/100"
                } else if (scan != null) {
                    "Nur Profil-Stats von @${scan.profile.handle} – für fundierte Tipps Video-Links scannen."
                } else {
                    "Noch kein Scan. Die KI antwortet dann mit allgemeinen Empfehlungen."
                },
                fontSize = 12.sp,
                color = MutedColor,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Prompts.MODES.chunked(2).forEach { row ->
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { entry ->
                        FilterChip(
                            selected = mode == entry.first,
                            onClick = { mode = entry.first },
                            label = { Text(entry.second, fontSize = 12.sp) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (row.size == 1) androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                }
            }
        }

        OutlinedTextField(
            value = topic,
            onValueChange = { topic = it },
            label = { Text("Nische oder Thema (optional)") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )

        Button(
            onClick = {
                scope.launch {
                    state.busy = true
                    error = null
                    answer = null
                    copied = false
                    saved = false
                    pendingText = null
                    try {
                        val (system, user) = Prompts.build(mode, topic, state.scan)
                        val text = Ai.chat(state.settings, system, user)
                        parsed = Ai.extractJson(text)
                        answer = text
                    } catch (exception: Exception) {
                        error = (exception.message ?: "Unbekannter Fehler") +
                            (exception as? Ai.AiException)?.hint?.let { "\n$it" }.orEmpty()
                    } finally {
                        state.busy = false
                    }
                }
            },
            enabled = !state.busy && state.settings.apiKey.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.busy) "KI arbeitet…" else Prompts.MODES.firstOrNull { it.first == mode }?.second ?: "Generieren", fontWeight = FontWeight.SemiBold)
        }

        if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())

        if (state.settings.apiKey.isBlank()) {
            CardBox {
                Text("Kein KI-Key", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = WarnColor)
                Text("Trage unter „Setup“ einen kostenlosen Key ein (Google AI Studio, Groq oder OpenRouter). Scannen und Rechnen funktionieren auch ohne.", fontSize = 12.sp, color = MutedColor)
            }
        }

        error?.let { message ->
            CardBox {
                Text("Das hat nicht geklappt", color = Danger, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(message, fontSize = 12.sp, color = MutedColor)
            }
        }

        answer?.let { text ->
            CardBox {
                val display = if (parsed) {
                    runCatching { JSONObject(text).toString(2) }.getOrDefault(text)
                } else {
                    text
                }
                androidx.compose.foundation.layout.Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(if (parsed) "Ergebnis" else "Antwort (kein klares JSON)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    TextButton(onClick = {
                        clipboard.setText(AnnotatedString(display))
                        copied = true
                    }) {
                        Text(if (copied) "Kopiert" else "Kopieren", fontSize = 12.sp)
                    }
                }
                androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = {
                        val title = Prompts.MODES.firstOrNull { it.first == mode }?.second ?: "KI-Antwort"
                        pendingText = TextExport.build(
                            title = title,
                            model = state.settings.model,
                            handle = state.scan?.profile?.handle,
                            raw = text,
                        )
                        saved = false
                        fileSaver.launch(TextExport.fileName(title))
                    }) {
                        Text("Als Textdatei speichern", fontSize = 12.sp)
                    }
                    if (saved) Text("Gespeichert", fontSize = 11.sp, color = GoodColor)
                }
                Text(
                    display,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                )
            }
        }
    }
}
