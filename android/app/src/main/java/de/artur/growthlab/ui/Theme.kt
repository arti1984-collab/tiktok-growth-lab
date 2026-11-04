package de.artur.growthlab.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Nachtstudio: warmes Anthrazit, cremefarbene Schrift, Gold nur als Signal.
 * Zahlen stehen in einer Serifenschrift wie in einem Kontobuch, die Flaeche
 * selbst bleibt still: Haarlinien statt Kartenstapel, 2 dp Radius, keine
 * Schatten, kein Leuchten.
 */
val Accent = Color(0xFFD9A94C)
val AccentBright = Color(0xFFE8BD68)
val Danger = Color(0xFFCF857C)
val BgColor = Color(0xFF141210)
val SurfaceColor = Color(0xFF1A1714)
val SurfaceElevated = Color(0xFF201C18)
val LineColor = Color(0xFF2E2A25)
val InkColor = Color(0xFFF3EBDD)
val InkSoft = Color(0xFFD6CBB8)
val MutedColor = Color(0xFFA79D8C)
val GoodColor = Color(0xFF8FBF95)
val WarnColor = Color(0xFFE0A86A)

val DisplayFont = FontFamily.Serif

private val DarkScheme = darkColorScheme(
    primary = Accent,
    onPrimary = Color(0xFF1B1409),
    secondary = InkSoft,
    onSecondary = BgColor,
    background = BgColor,
    onBackground = InkColor,
    surface = SurfaceColor,
    onSurface = InkColor,
    surfaceVariant = SurfaceElevated,
    onSurfaceVariant = MutedColor,
    outline = LineColor,
    outlineVariant = LineColor,
    error = Danger,
    onError = Color(0xFF1B0F0D),
)

private val Square = RoundedCornerShape(2.dp)
private val LabShapes = Shapes(
    extraSmall = Square,
    small = Square,
    medium = Square,
    large = RoundedCornerShape(3.dp),
    extraLarge = RoundedCornerShape(3.dp),
)

private val LabTypography = Typography(
    headlineSmall = TextStyle(fontFamily = DisplayFont, fontSize = 22.sp, fontWeight = FontWeight.Normal),
    titleLarge = TextStyle(fontFamily = DisplayFont, fontSize = 21.sp, fontWeight = FontWeight.Normal),
    titleMedium = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    bodyMedium = TextStyle(fontSize = 13.sp, lineHeight = 19.sp),
    bodySmall = TextStyle(fontSize = 11.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontSize = 11.sp),
    labelSmall = TextStyle(fontSize = 10.sp),
)

@Composable
fun GrowthLabTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkScheme, shapes = LabShapes, typography = LabTypography, content = content)
}
