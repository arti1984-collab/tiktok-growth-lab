import { labelFor } from "./JsonView";
import { useLang, useT } from "../lang";

/**
 * Ein Tag aus der KI-Antwort, als Zeile gelesen statt als JSON-Baum: erst der
 * Tag mit Uhrzeit, dann Thema und Hook, danach die Angaben zum Dreh. Ein
 * 30-Tage-Plan kommt mit Feld woche, dann steht vor jeder Woche eine Marke.
 */

type Day = Record<string, unknown>;

const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const asTags = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "") : [];

const weekOf = (day: Day): number => {
  const value = Number(day.woche);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
};

export function WeekPlan({ days }: { days: unknown[] }) {
  // Reading the language here switches the field labels with the setting.
  useLang();
  const t = useT();

  const groups: { week: number; items: Day[] }[] = [];
  for (const entry of days) {
    const day = (entry ?? {}) as Day;
    const week = weekOf(day);
    const last = groups[groups.length - 1];
    if (last && last.week === week) last.items.push(day);
    else groups.push({ week, items: [day] });
  }

  return (
    <div className="week-plan">
      {groups.map((group) => (
        <section className="week-block" key={`week-${group.week}-${group.items.length}`}>
          {group.week > 0 && <h3 className="week-heading">{t(`Woche ${group.week}`, `Week ${group.week}`)}</h3>}
          {group.items.map((day, index) => {
            const time = asText(day.uhrzeit);
            const topic = asText(day.thema);
            const hook = asText(day.hook);
            const tags = asTags(day.hashtags);
            const rows = (["format", "sound", "cta", "aufwand"] as const)
              .map((key) => ({ key, value: asText(day[key]) }))
              .filter((row) => row.value !== "");

            return (
              <article className="week-day" key={`day-${group.week}-${index}`}>
                <header className="week-day-head">
                  <span className="week-day-index">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{asText(day.tag) || t("Tag", "Day")}</h3>
                  {time && <span className="week-day-time">{time}</span>}
                </header>

                {topic && <p className="week-day-topic">{topic}</p>}
                {hook && <p className="week-day-hook">{hook}</p>}

                {rows.length > 0 && (
                  <dl className="week-day-rows">
                    {rows.map((row) => (
                      <div key={row.key}>
                        <dt>{labelFor(row.key)}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {tags.length > 0 && (
                  <div className="chip-row week-day-tags">
                    {tags.map((tag) => (
                      <span className="chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
