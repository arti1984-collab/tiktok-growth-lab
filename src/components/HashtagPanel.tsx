import { useMemo, useState } from "react";

type Group = { name: string; tags: string[] };

/** Keeps only what a usable hashtag is: letters, digits, underscore. */
const clean = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const tag = value
    .trim()
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_]/gu, "");
  if (!tag || tag.length > 40) return null;
  return tag;
};

const pushTags = (value: unknown, into: string[]) => {
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    const tag = clean(entry);
    if (tag) into.push(tag);
  }
};

/**
 * Reads hashtags from every place the AI may put them: the strategy block first,
 * then the per-item hashtags of captions, video ideas and the 7-day plan.
 */
export function extractHashtagGroups(result: unknown): Group[] {
  if (!result || typeof result !== "object") return [];
  const data = result as Record<string, unknown>;
  const groups: Group[] = [];

  const strategy = data.hashtagStrategie;
  if (strategy && typeof strategy === "object") {
    const block = strategy as Record<string, unknown>;
    const buckets: [string, string][] = [
      ["nische", "Nische"],
      ["reichweite", "Reichweite"],
      ["marke", "Marke"],
    ];
    for (const [key, name] of buckets) {
      const tags: string[] = [];
      pushTags(block[key], tags);
      if (tags.length > 0) groups.push({ name, tags: [...new Set(tags)] });
    }
  }

  const extra: string[] = [];
  for (const key of ["captions", "ideen", "tage"]) {
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item === "object") pushTags((item as Record<string, unknown>).hashtags, extra);
    }
  }
  if (extra.length > 0) {
    groups.push({ name: "Aus den Vorschlägen", tags: [...new Set(extra)].slice(0, 30) });
  }

  return groups;
}

export function HashtagPanel({ result, embedded = false }: { result: unknown; embedded?: boolean }) {
  const groups = useMemo(() => extractHashtagGroups(result), [result]);
  const [copied, setCopied] = useState<string | null>(null);

  if (groups.length === 0) return null;

  const allTags = [...new Set(groups.flatMap((group) => group.tags))];

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied("fehler");
    }
  };

  return (
    <section className={`hashtag-panel${embedded ? " hashtag-panel-embedded" : ""}`} aria-label="Hashtag-Bereich">
      <div className="hashtag-head">
        <div>
          {!embedded && <h3>Hashtag-Bereich</h3>}
          <p className="muted small">
            {allTags.length} Tags, sortiert nach Aufgabe. Tag antippen kopiert ihn.
            {copied === "fehler" ? " Kopieren wurde vom Browser blockiert." : ""}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => copy(allTags.map((tag) => `#${tag}`).join(" "), "alle")}
        >
          {copied === "alle" ? "Alle kopiert" : "Alle kopieren"}
        </button>
      </div>

      {groups.map((group) => (
        <div className="hashtag-group" key={group.name}>
          <span className="hashtag-group-name">{group.name}</span>
          <div className="chip-row">
            {group.tags.map((tag) => (
              <button
                type="button"
                className="hashtag-chip"
                key={`${group.name}-${tag}`}
                onClick={() => copy(`#${tag}`, tag)}
                aria-label={`Hashtag ${tag} kopieren`}
              >
                #{tag}
                {copied === tag ? <span className="hashtag-copied">kopiert</span> : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
