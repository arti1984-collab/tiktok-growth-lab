package de.artur.growthlab.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Cyan = Color(0xFF25F4EE)
val Pink = Color(0xFFFE2C55)
val BgColor = Color(0xFF0B0F14)
val SurfaceColor = Color(0xFF121A22)
val MutedColor = Color(0xFF93A1B1)
val GoodColor = Color(0xFF4ADE80)
val WarnColor = Color(0xFFFBBF24)

private val DarkScheme = darkColorScheme(
    primary = Cyan,
    onPrimary = Color(0xFF001014),
    secondary = Pink,
    onSecondary = Color(0xFF1A0006),
    background = BgColor,
    onBackground = Color(0xFFE7EEF6),
    surface = SurfaceColor,
    onSurface = Color(0xFFE7EEF6),
    surfaceVariant = Color(0xFF18222D),
    onSurfaceVariant = MutedColor,
)

@Composable
fun GrowthLabTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkScheme, content = content)
}
