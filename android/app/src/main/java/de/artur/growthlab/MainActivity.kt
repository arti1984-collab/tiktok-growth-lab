package de.artur.growthlab

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.artur.growthlab.data.AiSettings
import de.artur.growthlab.data.Metrics
import de.artur.growthlab.data.Profile
import de.artur.growthlab.data.ScanResult
import de.artur.growthlab.data.Store
import de.artur.growthlab.data.TrackedAccount
import de.artur.growthlab.ui.Cyan
import de.artur.growthlab.ui.GrowthLabTheme
import de.artur.growthlab.ui.GrowthScreen
import de.artur.growthlab.ui.ScanScreen
import de.artur.growthlab.ui.SettingsScreen
import de.artur.growthlab.ui.StudioScreen

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
    val tabs = listOf("Scan" to "🔍", "Wachstum" to "📈", "KI-Studio" to "✨", "Setup" to "⚙")

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Surface(color = MaterialTheme.colorScheme.background) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text("TikTok Growth Lab", fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "Scraping + KI-Coach für mehr Reichweite",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        if (state.settings.apiKey.isBlank()) "KI: kein Key" else "KI bereit",
                        fontSize = 11.sp,
                        color = if (state.settings.apiKey.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else Cyan,
                    )
                }
            }
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                tabs.forEachIndexed { index, entry ->
                    NavigationBarItem(
                        selected = tab == index,
                        onClick = { tab = index },
                        icon = { Text(entry.second, fontSize = 16.sp) },
                        label = { Text(entry.first, fontSize = 10.sp, maxLines = 1) },
                    )
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                0 -> ScanScreen(state)
                1 -> GrowthScreen(state)
                2 -> StudioScreen(state)
                else -> SettingsScreen(state)
            }
        }
    }
}
