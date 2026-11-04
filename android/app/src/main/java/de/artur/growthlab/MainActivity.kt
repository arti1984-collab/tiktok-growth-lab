package de.artur.growthlab

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.artur.growthlab.data.AiSettings
import de.artur.growthlab.data.Lang
import de.artur.growthlab.data.Language
import de.artur.growthlab.data.Metrics
import de.artur.growthlab.data.Profile
import de.artur.growthlab.data.ScanResult
import de.artur.growthlab.data.Store
import de.artur.growthlab.data.TrackedAccount
import de.artur.growthlab.data.Update
import de.artur.growthlab.data.tr
import de.artur.growthlab.ui.Accent
import de.artur.growthlab.ui.BgColor
import de.artur.growthlab.ui.DividerLine
import de.artur.growthlab.ui.DisplayFont
import de.artur.growthlab.ui.GrowthLabTheme
import de.artur.growthlab.ui.GrowthScreen
import de.artur.growthlab.ui.InkColor
import de.artur.growthlab.ui.LineColor
import de.artur.growthlab.ui.MutedColor
import de.artur.growthlab.ui.ScanScreen
import de.artur.growthlab.ui.SettingsScreen
import de.artur.growthlab.ui.StudioScreen
import de.artur.growthlab.ui.TutorialScreen
import de.artur.growthlab.ui.openUrl

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            GrowthLabTheme {
                Root(applicationContext)
            }
        }
    }
}

/** Everything the screens share; persists settings and history as it changes. */
class LabState(private val context: Context) {
    var settings by mutableStateOf(Store.loadSettings(context))
    var accounts by mutableStateOf(Store.loadAccounts(context))
    var scan by mutableStateOf<ScanResult?>(null)
    var busy by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var progress by mutableStateOf("")
    var update by mutableStateOf<Update.Info?>(null)

    fun saveSettings(next: AiSettings) {
        settings = next
        Store.saveSettings(context, next)
    }

    fun track(profile: Profile, metrics: Metrics?) {
        accounts = Store.addSnapshot(context, profile, metrics)
    }

    fun remove(handle: String) {
        accounts = Store.removeAccount(context, handle)
    }

    fun reload() {
        accounts = Store.loadAccounts(context)
    }
}

@Composable
fun Root(context: Context) {
    val state = remember { LabState(context) }
    var tab by remember { mutableStateOf(0) }
    // The stored language drives every screen; reading it here keeps the switch instant.
    Language.current = Lang.fromCode(state.settings.language)
    val tabs = listOf("Scan", tr("Wachstum", "Growth"), tr("KI-Studio", "AI studio"), tr("Setup", "Setup"), tr("Hilfe", "Guide"))
    var updateHidden by remember { mutableStateOf(false) }
    // One check per start, so a new release shows up without opening the setup tab.
    LaunchedEffect(Unit) { state.update = Update.check(state.settings.githubToken) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Surface(color = BgColor) {
                Column {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column {
                            Text("TikTok Growth Lab", fontFamily = DisplayFont, fontSize = 20.sp, color = InkColor)
                            Text(
                                tr("Scraping + KI-Coach für mehr Reichweite", "Scraping + AI coach for more reach"),
                                fontSize = 10.sp,
                                color = MutedColor,
                            )
                        }
                        Text(
                            if (state.settings.apiKey.isBlank()) tr("KI: kein Key", "AI: no key") else tr("KI bereit", "AI ready"),
                            fontSize = 10.sp,
                            color = if (state.settings.apiKey.isBlank()) MutedColor else Accent,
                        )
                    }
                    DividerLine()
                }
            }
        },
        bottomBar = {
            Column {
                DividerLine()
                Text(
                    "Version ${BuildConfig.VERSION_NAME}",
                    fontSize = 9.sp,
                    color = MutedColor,
                    textAlign = TextAlign.End,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 3.dp),
                )
                NavigationBar(
                    containerColor = BgColor,
                    tonalElevation = 0.dp,
                    windowInsets = NavigationBarDefaults.windowInsets,
                ) {
                    tabs.forEachIndexed { index, entry ->
                        NavigationBarItem(
                            selected = tab == index,
                            onClick = { tab = index },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Accent,
                                selectedTextColor = InkColor,
                                unselectedIconColor = MutedColor,
                                unselectedTextColor = MutedColor,
                                indicatorColor = LineColor,
                            ),
                            icon = {
                                NavGlyph(
                                    index = index,
                                    tint = if (tab == index) Accent else MutedColor,
                                )
                            },
                            label = { Text(entry, fontSize = 10.sp, maxLines = 1) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            val info = state.update
            if (info?.available == true && info.latest != null && !updateHidden) {
                UpdateBanner(
                    text = tr(
                        "Version ${info.latest} ist verfügbar, du nutzt ${info.current}.",
                        "Version ${info.latest} is available, you are on ${info.current}.",
                    ),
                    action = tr("Herunterladen", "Download"),
                    onAction = { openUrl(context, info.apk ?: info.url) },
                    onDismiss = { updateHidden = true },
                )
            }
            when (tab) {
                0 -> ScanScreen(state)
                1 -> GrowthScreen(state)
                2 -> StudioScreen(state)
                3 -> SettingsScreen(state)
                else -> TutorialScreen()
            }
        }
    }
}

/** One line above the content, so an available update is hard to miss. */
@Composable
private fun UpdateBanner(text: String, action: String, onAction: () -> Unit, onDismiss: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(text, fontSize = 11.sp, color = InkColor, modifier = Modifier.weight(1f))
        androidx.compose.material3.TextButton(onClick = onAction) {
            Text(action, fontSize = 11.sp, color = Accent)
        }
        androidx.compose.material3.TextButton(onClick = onDismiss) {
            Text("✕", fontSize = 11.sp, color = MutedColor)
        }
    }
    DividerLine()
}

/**
 * Drawn navigation glyphs instead of emoji: each one shows what the tab does
 * (search, rising line, text lines, sliders) and none of them is a borrowed
 * icon-library look.
 */
@Composable
private fun NavGlyph(index: Int, tint: Color) {
    Canvas(Modifier.size(22.dp)) {
        val s = size.minDimension
        val stroke = s * 0.1f
        when (index) {
            0 -> {
                drawCircle(tint, radius = s * 0.26f, center = Offset(s * 0.42f, s * 0.42f), style = Stroke(width = stroke))
                drawLine(tint, Offset(s * 0.62f, s * 0.62f), Offset(s * 0.86f, s * 0.86f), stroke, StrokeCap.Round)
            }

            1 -> {
                drawLine(tint, Offset(s * 0.12f, s * 0.8f), Offset(s * 0.38f, s * 0.5f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.38f, s * 0.5f), Offset(s * 0.58f, s * 0.64f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.58f, s * 0.64f), Offset(s * 0.84f, s * 0.26f), stroke, StrokeCap.Round)
                drawCircle(tint, radius = s * 0.1f, center = Offset(s * 0.84f, s * 0.26f))
            }

            2 -> {
                drawLine(tint, Offset(s * 0.2f, s * 0.32f), Offset(s * 0.8f, s * 0.32f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.2f, s * 0.52f), Offset(s * 0.8f, s * 0.52f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.2f, s * 0.72f), Offset(s * 0.56f, s * 0.72f), stroke, StrokeCap.Round)
            }

            3 -> {
                drawLine(tint, Offset(s * 0.14f, s * 0.36f), Offset(s * 0.86f, s * 0.36f), stroke, StrokeCap.Round)
                drawCircle(tint, radius = s * 0.11f, center = Offset(s * 0.64f, s * 0.36f))
                drawLine(tint, Offset(s * 0.14f, s * 0.68f), Offset(s * 0.86f, s * 0.68f), stroke, StrokeCap.Round)
                drawCircle(tint, radius = s * 0.11f, center = Offset(s * 0.34f, s * 0.68f))
            }

            else -> {
                drawLine(tint, Offset(s * 0.2f, s * 0.2f), Offset(s * 0.8f, s * 0.2f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.2f, s * 0.8f), Offset(s * 0.8f, s * 0.8f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.2f, s * 0.2f), Offset(s * 0.2f, s * 0.8f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.8f, s * 0.2f), Offset(s * 0.8f, s * 0.8f), stroke, StrokeCap.Round)
                drawLine(tint, Offset(s * 0.5f, s * 0.2f), Offset(s * 0.5f, s * 0.8f), stroke, StrokeCap.Round)
            }
        }
    }
}
