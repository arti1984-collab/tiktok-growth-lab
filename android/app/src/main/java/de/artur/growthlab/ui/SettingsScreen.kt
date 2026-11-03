package de.artur.growthlab.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.artur.growthlab.LabState
import de.artur.growthlab.data.Ai
import de.artur.growthlab.data.AiSettings
import de.artur.growthlab.data.Provider
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(state: LabState) {
    val scope = rememberCoroutineScope()
    var baseUrl by remember { mutableStateOf(state.settings.baseUrl) }
    var model by remember { mutableStateOf(state.settings.model) }
    var apiKey by remember { mutableStateOf(state.settings.apiKey) }
    var models by remember { mutableStateOf<List<String>>(emptyList()) }
    var message by remember { mutableStateOf<String?>(null) }
    var loadingModels by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenTitle("Einstellungen", "Kostenlose KI-Anbieter, Modell und Key.")

        CardBox {
            Text("Anbieter", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Provider.entries.forEach { entry ->
                FilterChip(
                    selected = baseUrl == entry.baseUrl,
                    onClick = {
                        baseUrl = entry.baseUrl
                        model = entry.models.first().first
                        message = null
                    },
                    label = { Text(entry.name, fontSize = 12.sp) },
                )
                Text(entry.freeNote, fontSize = 11.sp, color = MutedColor)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                    entry.models.take(2).forEach { pair ->
                        AssistChip(
                            onClick = { model = pair.first },
                            label = { Text(pair.second, fontSize = 11.sp) },
                        )
                    }
                }
            }
        }

        OutlinedTextField(
            value = baseUrl,
            onValueChange = { baseUrl = it },
            label = { Text("Basis-URL (OpenAI-kompatibel)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = model,
            onValueChange = { model = it },
            label = { Text("Modell") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = apiKey,
            onValueChange = { apiKey = it },
            label = { Text("API-Key") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                onClick = {
                    scope.launch {
                        loadingModels = true
                        message = null
                        try {
                            models = Ai.listModels(AiSettings(baseUrl, model, apiKey))
                            message = if (models.isEmpty()) "Der Anbieter hat keine Modelle gemeldet." else "${models.size} Modelle geladen."
                        } catch (error: Exception) {
                            message = error.message
                        } finally {
                            loadingModels = false
                        }
                    }
                },
                enabled = !loadingModels,
                modifier = Modifier.weight(1f),
            ) {
                Text(if (loadingModels) "Lade…" else "Modelle laden", fontSize = 12.sp)
            }
            Button(
                onClick = {
                    state.saveSettings(AiSettings(baseUrl.trim(), model.trim(), apiKey.trim()))
                    message = "Gespeichert. Key liegt nur auf diesem Handy."
                },
                modifier = Modifier.weight(1f),
            ) {
                Text("Speichern", fontSize = 12.sp)
            }
        }

        if (models.isNotEmpty()) {
            CardBox {
                Text("Verfügbare Modelle (antippen zum Übernehmen)", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                models.take(40).forEach { entry ->
                    TextButton(onClick = { model = entry }) {
                        Text(entry, fontSize = 11.sp)
                    }
                }
            }
        }

        message?.let {
            CardBox {
                Text(it, fontSize = 12.sp, color = MutedColor)
            }
        }

        CardBox {
            Text("Woher die Daten kommen", fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(
                "Profile und Videos werden direkt von tiktok.com gelesen, ohne Login. Alles wird nur auf diesem Handy gespeichert; nach außen gehen ausschließlich die Anfragen an TikTok und deinen KI-Anbieter.",
                fontSize = 11.sp,
                color = MutedColor,
            )
        }
    }
}
