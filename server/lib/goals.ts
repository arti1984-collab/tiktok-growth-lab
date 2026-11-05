/**
 * Ein Ziel gehoert zu einem Profil. Nur so laesst sich zeigen, wie weit man
 * seit dem Zielstart gekommen ist: der Startpunkt wird beim ersten Speichern
 * festgehalten und bleibt, auch wenn das Ziel spaeter nach oben wandert.
 */

export type Goal = {
  handle: string;
  followers: number;
  date: string;
  /** Follower beim Anlegen des Ziels, 0 wenn unbekannt. */
  startFollowers: number;
  startedAt: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "@Name" und "name " landen beide als "name" in der Datei. */
export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

/** Nur vollstaendige Ziele zaehlen; kaputte Eintraege fallen still raus. */
export function normalizeGoals(raw: unknown): Goal[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const goals: Goal[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Partial<Goal>;
    const handle = normalizeHandle(String(value.handle ?? ""));
    const followers = Math.round(Number(value.followers));
    const date = String(value.date ?? "");
    if (!handle || !Number.isFinite(followers) || followers <= 0 || !DATE.test(date) || seen.has(handle)) continue;
    seen.add(handle);
    goals.push({
      handle,
      followers,
      date,
      startFollowers: Math.max(0, Math.round(Number(value.startFollowers)) || 0),
      startedAt: Math.max(0, Math.round(Number(value.startedAt)) || 0),
    });
  }
  return goals;
}

/**
 * Ziel anlegen oder aendern. Ein vorhandenes Ziel behaelt seinen Startpunkt,
 * sonst waere "seit Zielstart" nach jeder Aenderung wieder bei null.
 */
export function upsertGoal(
  goals: unknown,
  input: { handle: string; followers: number; date: string; startFollowers?: number },
  now = Date.now(),
): Goal[] {
  const handle = normalizeHandle(input.handle);
  const followers = Math.round(input.followers);
  const date = String(input.date ?? "");
  if (!handle || !Number.isFinite(followers) || followers <= 0 || !DATE.test(date)) return normalizeGoals(goals);

  const list = normalizeGoals(goals);
  const existing = list.find((goal) => goal.handle === handle);
  const givenStart = Math.max(0, Math.round(Number(input.startFollowers)) || 0);
  const startFollowers = existing && existing.startFollowers > 0 ? existing.startFollowers : givenStart;
  const startedAt = existing && existing.startedAt > 0 ? existing.startedAt : startFollowers > 0 ? now : 0;

  const next: Goal = { handle, followers, date, startFollowers, startedAt };
  return [...list.filter((goal) => goal.handle !== handle), next].sort((left, right) =>
    left.handle.localeCompare(right.handle),
  );
}

export function removeGoal(goals: unknown, handle: string): Goal[] {
  const key = normalizeHandle(handle);
  return normalizeGoals(goals).filter((goal) => goal.handle !== key);
}

/** Wie viel des Wegs seit dem Zielstart geschafft ist, in Prozent. */
export function goalProgress(goal: Goal, currentFollowers: number): number | null {
  const span = goal.followers - goal.startFollowers;
  if (span <= 0 || goal.startFollowers <= 0 || !Number.isFinite(currentFollowers)) return null;
  return Math.max(0, Math.min(100, ((currentFollowers - goal.startFollowers) / span) * 100));
}
