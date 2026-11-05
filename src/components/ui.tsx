import type { ReactNode } from "react";

export function Section({
  title,
  subtitle,
  actions,
  children,
  className = "",
  collapsible = false,
  collapsed = false,
  onToggle,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Titel wird zum Knopf, der den Inhalt ein- und ausklappt. */
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <section className={`card ${className}${collapsed ? " is-collapsed" : ""}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title &&
              (collapsible ? (
                <h2>
                  <button type="button" className="card-toggle" aria-expanded={!collapsed} onClick={onToggle}>
                    <Chevron open={!collapsed} />
                    {title}
                  </button>
                </h2>
              ) : (
                <h2>{title}</h2>
              ))}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions && <div className="row gap-sm">{actions}</div>}
        </header>
      )}
      {!collapsed && children}
    </section>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`chevron${open ? " open" : ""}`} width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "accent";
}) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "accent" | "info" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden />
      {label && <span>{label}</span>}
    </span>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "warn" | "info" | "success"; children: ReactNode }) {
  return <div className={`alert alert-${kind}`}>{children}</div>;
}

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {children}
    </div>
  );
}

export function Sparkline({ points, width = 120, height = 32 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return <span className="muted small">zu wenig Daten</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${(height - ((value - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  const rising = points[points.length - 1] >= points[0];
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={path} fill="none" stroke={rising ? "var(--good)" : "var(--warn)"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const width = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="progress" title={label}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}
