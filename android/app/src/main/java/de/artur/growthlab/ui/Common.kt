package de.artur.growthlab.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun num(value: Long): String = NumberFormat.getIntegerInstance(Locale.GERMANY).format(value)
fun dec(value: Double, digits: Int = 1): String = String.format(Locale.GERMANY, "%.${digits}f", value)
fun dateShort(millis: Long): String = SimpleDateFormat("dd.MM.yy, HH:mm", Locale.GERMANY).format(Date(millis))
fun dateOnly(millis: Long): String = SimpleDateFormat("dd.MM.yy", Locale.GERMANY).format(Date(millis))

@Composable
fun CardBox(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
fun ScreenTitle(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        if (subtitle != null) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun KpiTile(label: String, value: String, note: String? = null, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(14.dp),
        modifier = modifier,
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(label.uppercase(), fontSize = 10.sp, color = MutedColor, fontWeight = FontWeight.SemiBold)
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            if (note != null) Text(note, fontSize = 10.sp, color = MutedColor)
        }
    }
}

@Composable
fun Pill(text: String, tone: Color) {
    Surface(color = tone.copy(alpha = 0.16f), shape = RoundedCornerShape(50)) {
        Text(text, color = tone, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

@Composable
fun InsightRow(kind: String, title: String, text: String) {
    val tone = when (kind) {
        "good" -> GoodColor
        "warn" -> WarnColor
        else -> Cyan
    }
    Row(verticalAlignment = Alignment.Top) {
        Surface(color = tone, shape = RoundedCornerShape(50)) {
            Spacer(Modifier.width(6.dp).padding(3.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(text, fontSize = 12.sp, color = MutedColor)
        }
    }
}

@Composable
fun DividerLine() {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.fillMaxWidth()) {
        Spacer(Modifier.padding(0.5.dp))
    }
}
