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
import de.artur.growthlab.data.Language
import de.artur.growthlab.data.Provider
import de.artur.growthlab.data.english
import de.artur.growthlab.data.tr
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
        ScreenTitle(tr("Einstellungen", "Settings"), tr("Sprache, kostenlose KI-Anbieter, Modell und Key.", "Language, free AI providers, model and key."))

        CardBox {
            Text(tr("Sprache", "Language"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(
                tr(
                    "Gilt für die Oberfläche, die Anleitung und die Texte der KI. Die Wahl bleibt nach einem Neustart gespeichert.",
                    "Applies to the interface, the guide and the texts the AI writes. The choice survives a restart.",
                ),
                fontSize = 11.sp,
                color = MutedColor,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !english(),
                    onClick = { state.saveSettings(state.settings.copy(language = "de")) },
                    label = { Text("Deutsch", fontSize = 12.sp) },
                )
                FilterChip(
                    selected = english(),
                    onClick = { state.saveSettings(state.settings.copy(language = "en")) },
                    label = { Text("English", fontSize = 12.sp) },
                )
            }
        }

        CardBox {
            Text(tr("Anbieter", "Providers"), fontWeight = FontWeight.Bold, fontSize = 14.sp)
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
            label = { Text(tr("Basis-URL (OpenAI-kompatibel)", "Base URL (OpenAI compatible)")) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = model,
            onValueChange = { model = it },
            label = { Text(tr("Modell", "Model")) },
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
                            models = Ai.listModels(AiSettings(baseUrl, model, apiKey, Language.current.code))
                            message = if (models.isEmpty()) {
                                tr("Der Anbieter hat keine Modelle gemeldet.", "The provider reported no models.")
                            } else {
                                tr("${models.size} Modelle geladen.", "${models.size} models loaded.")
                            }
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
                Text(if (loadingModels) tr("Lade…", "Loading…") else tr("Modelle laden", "Load models"), fontSize = 12.sp)
            }
            Button(
                onClick = {
                    // The language is kept, the rest comes from the fields.
                    state.saveSettings(AiSettings(baseUrl.trim(), model.trim(), apiKey.trim(), state.settings.language))
                    message = tr(
                        "Gespeichert. Key liegt nur auf diesem Handy.",
                        "Saved. The key stays on this phone only.",
                    )
                },
                modifier = Modifier.weight(1f),
            ) {
                Text(tr("Speichern", "Save"), fontSize = 12.sp)
            }
        }

        if (models.isNotEmpty()) {
            CardBox {
                Text(
                    tr("Verfügbare Modelle (antippen zum Übernehmen)", "Available models (tap to use)"),
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                )
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
            Text(tr("Woher die Daten kommen", "Where the data comes from"), fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(
                tr(
                    "Profile und Videos werden direkt von tiktok.com gelesen, ohne Login. Alles wird nur auf diesem Handy gespeichert; nach außen gehen ausschließlich die Anfragen an TikTok und deinen KI-Anbieter.",
                    "Profiles and videos are read straight from tiktok.com without a login. Everything stays on this phone; the only requests leaving it are the ones to TikTok and your AI provider.",
                ),
                fontSize = 11.sp,
                color = MutedColor,
            )
        }
    }
}
