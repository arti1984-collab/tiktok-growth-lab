package de.artur.growthlab.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Small JSON store on top of SharedPreferences – the mobile counterpart of data/store.json. */
object Store {
    private const val PREFS = "growthlab"
    private const val KEY_SETTINGS = "settings"
    private const val KEY_ACCOUNTS = "accounts"
    private const val KEY_PLAN = "plan"
    private const val MAX_SNAPSHOTS = 200

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun loadSettings(context: Context): AiSettings {
        val raw = prefs(context).getString(KEY_SETTINGS, null) ?: return AiSettings()
        return try {
            val json = JSONObject(raw)
            AiSettings(
                baseUrl = json.optString("baseUrl", Provider.GEMINI_BASE),
                model = json.optString("model", Provider.GEMINI_MODELS.first().first),
                apiKey = json.optString("apiKey", ""),
                language = json.optString("language", "de"),
                githubToken = json.optString("githubToken", ""),
            )
        } catch (error: Exception) {
            AiSettings()
        }
    }

    fun saveSettings(context: Context, settings: AiSettings) {
        val json = JSONObject()
            .put("baseUrl", settings.baseUrl)
            .put("model", settings.model)
            .put("apiKey", settings.apiKey)
            .put("language", settings.language)
            .put("githubToken", settings.githubToken)
        prefs(context).edit().putString(KEY_SETTINGS, json.toString()).apply()
    }

    fun loadAccounts(context: Context): List<TrackedAccount> {
        val raw = prefs(context).getString(KEY_ACCOUNTS, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { index ->
                val node = array.optJSONObject(index) ?: return@mapNotNull null
                val snapshots = node.optJSONArray("snapshots") ?: JSONArray()
                TrackedAccount(
                    handle = node.optString("handle", ""),
                    nickname = node.optString("nickname", ""),
                    snapshots = (0 until snapshots.length()).mapNotNull { position ->
                        val snapshot = snapshots.optJSONObject(position) ?: return@mapNotNull null
                        Snapshot(
                            at = snapshot.optLong("at", 0),
                            followers = snapshot.optLong("followers", 0),
                            following = snapshot.optLong("following", 0),
                            hearts = snapshot.optLong("hearts", 0),
                            videos = snapshot.optLong("videos", 0),
                            engagementRate = if (snapshot.isNull("engagementRate")) null else snapshot.optDouble("engagementRate"),
                            score = if (snapshot.isNull("score")) null else snapshot.optInt("score"),
                        )
                    },
                )
            }
        } catch (error: Exception) {
            emptyList()
        }
    }

    private fun saveAccounts(context: Context, accounts: List<TrackedAccount>) {
        val array = JSONArray()
        for (account in accounts) {
            val snapshots = JSONArray()
            for (snapshot in account.snapshots.takeLast(MAX_SNAPSHOTS)) {
                snapshots.put(
                    JSONObject()
                        .put("at", snapshot.at)
                        .put("followers", snapshot.followers)
                        .put("following", snapshot.following)
                        .put("hearts", snapshot.hearts)
                        .put("videos", snapshot.videos)
                        .put("engagementRate", snapshot.engagementRate ?: JSONObject.NULL)
                        .put("score", snapshot.score ?: JSONObject.NULL),
                )
            }
            array.put(
                JSONObject()
                    .put("handle", account.handle)
                    .put("nickname", account.nickname)
                    .put("snapshots", snapshots),
            )
        }
        prefs(context).edit().putString(KEY_ACCOUNTS, array.toString()).apply()
    }

    fun addSnapshot(context: Context, profile: Profile, metrics: Metrics?): List<TrackedAccount> {
        val accounts = loadAccounts(context).toMutableList()
        val snapshot = Snapshot(
            at = System.currentTimeMillis(),
            followers = profile.followers,
            following = profile.following,
            hearts = profile.hearts,
            videos = profile.videos,
            engagementRate = metrics?.engagementRate,
            score = metrics?.score,
        )
        val index = accounts.indexOfFirst { it.handle.equals(profile.handle, ignoreCase = true) }
        if (index >= 0) {
            val existing = accounts[index]
            accounts[index] = existing.copy(
                nickname = profile.nickname.ifBlank { existing.nickname },
                snapshots = (existing.snapshots + snapshot).takeLast(MAX_SNAPSHOTS),
            )
        } else {
            accounts.add(TrackedAccount(profile.handle, profile.nickname, listOf(snapshot)))
        }
        saveAccounts(context, accounts)
        return accounts
    }

    fun loadPlan(context: Context): List<PlanItem> {
        val raw = prefs(context).getString(KEY_PLAN, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { index ->
                val node = array.optJSONObject(index) ?: return@mapNotNull null
                PlanItem(
                    id = node.optString("id", ""),
                    date = node.optString("date", ""),
                    time = node.optString("time", ""),
                    note = node.optString("note", ""),
                    status = node.optString("status", "planned"),
                    videoUrl = node.optString("videoUrl", ""),
                    createdAt = node.optLong("createdAt", 0),
                )
            }.filter { it.id.isNotBlank() && it.date.isNotBlank() }
                .sortedBy { "${it.date} ${it.time}" }
        } catch (error: Exception) {
            emptyList()
        }
    }

    fun savePlan(context: Context, items: List<PlanItem>) {
        val array = JSONArray()
        for (item in items) {
            array.put(
                JSONObject()
                    .put("id", item.id)
                    .put("date", item.date)
                    .put("time", item.time)
                    .put("note", item.note)
                    .put("status", item.status)
                    .put("videoUrl", item.videoUrl)
                    .put("createdAt", item.createdAt),
            )
        }
        prefs(context).edit().putString(KEY_PLAN, array.toString()).apply()
    }

    fun removeAccount(context: Context, handle: String): List<TrackedAccount> {
        val remaining = loadAccounts(context).filterNot { it.handle.equals(handle, ignoreCase = true) }
        saveAccounts(context, remaining)
        return remaining
    }
}

/** Read helpers for the growth screen. */
fun TrackedAccount.latest(): Snapshot? = snapshots.lastOrNull()
fun TrackedAccount.first(): Snapshot? = snapshots.firstOrNull()
fun TrackedAccount.deltaAll(): Long? {
    val first = first() ?: return null
    val latest = latest() ?: return null
    return latest.followers - first.followers
}
