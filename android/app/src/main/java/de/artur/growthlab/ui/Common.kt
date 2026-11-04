package de.artur.growthlab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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

private val PanelShape = RoundedCornerShape(2.dp)

/** A panel is a hairline around content, not a floating card. */
@Composable
fun CardBox(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .border(1.dp, LineColor, PanelShape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

@Composable
fun ScreenTitle(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(title, fontFamily = DisplayFont, fontSize = 22.sp, color = InkColor)
        if (subtitle != null) {
            Text(subtitle, fontSize = 11.sp, color = MutedColor, lineHeight = 16.sp)
        }
    }
}

/** Numbers carry the app, so they get the display serif and a hairline frame. */
@Composable
fun KpiTile(label: String, value: String, note: String? = null, modifier: Modifier = Modifier) {
    Column(
        modifier
            .border(1.dp, LineColor, PanelShape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, fontSize = 10.sp, color = MutedColor, maxLines = 1)
        Text(value, fontFamily = DisplayFont, fontSize = 21.sp, color = InkColor, maxLines = 1)
        if (note != null) Text(note, fontSize = 10.sp, color = MutedColor, maxLines = 1)
    }
}

@Composable
fun Pill(text: String, tone: Color) {
    Text(
        text,
        color = tone,
        fontSize = 10.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .border(1.dp, tone.copy(alpha = 0.5f), PanelShape)
            .padding(horizontal = 7.dp, vertical = 2.dp),
    )
}

@Composable
fun InsightRow(kind: String, title: String, text: String) {
    val tone = when (kind) {
        "good" -> GoodColor
        "warn" -> WarnColor
        else -> InkSoft
    }
    Row(verticalAlignment = Alignment.Top) {
        Box(Modifier.padding(top = 6.dp).size(6.dp).background(tone))
        Box(Modifier.padding(start = 12.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = InkColor)
                Text(text, fontSize = 12.sp, color = InkSoft, lineHeight = 17.sp)
            }
        }
    }
}

@Composable
fun DividerLine() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
}
