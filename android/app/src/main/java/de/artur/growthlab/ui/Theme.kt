package de.artur.growthlab.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * One accent for the whole app (gold), plus semantic colours for status only.
 * The former cyan/pink pair imitated TikTok's trade dress, which would break
 * as soon as other platforms are added.
 */
val Accent = Color(0xFFE8B34B)
val Danger = Color(0xFFF2707A)
val BgColor = Color(0xFF0B0F14)
val SurfaceColor = Color(0xFF121A22)
val MutedColor = Color(0xFF9AA8B6)
val GoodColor = Color(0xFF4ADE80)
val WarnColor = Color(0xFFFBBF24)

private val DarkScheme = darkColorScheme(
    primary = Accent,
    onPrimary = Color(0xFF1A1206),
    secondary = Color(0xFF8FA3B8),
    onSecondary = Color(0xFF0B1218),
    background = BgColor,
    onBackground = Color(0xFFE7EEF6),
    surface = SurfaceColor,
    onSurface = Color(0xFFE7EEF6),
    surfaceVariant = Color(0xFF18222D),
    onSurfaceVariant = MutedColor,
    error = Danger,
)

@Composable
fun GrowthLabTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkScheme, content = content)
}
