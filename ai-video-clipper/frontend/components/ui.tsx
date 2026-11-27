"use client";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-haze-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-haze-400">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-haze-500">{hint}</div>}
    </div>
  );
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 80 ? "text-mint border-mint/40 bg-mint/10" : score >= 60 ? "text-amber border-amber/40 bg-amber/10" : "text-haze-300 border-ink-600 bg-ink-800";
  const dims = size === "lg" ? "h-16 w-16 text-2xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-base";
  return (
    <div title="Estimated engagement score (0-100). An estimate, not a prediction of virality."
      className={`flex shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums ${color} ${dims}`}>
      {score}
    </div>
  );
}

const STATUS: Record<string, string> = {
  ready: "bg-mint/10 text-mint border-mint/30",
  rendered: "bg-mint/10 text-mint border-mint/30",
  processing: "bg-accent-soft text-accent-strong border-accent/30",
  rendering: "bg-accent-soft text-accent-strong border-accent/30",
  queued: "bg-amber/10 text-amber border-amber/30",
  running: "bg-accent-soft text-accent-strong border-accent/30",
  awaiting_upload: "bg-amber/10 text-amber border-amber/30",
  failed: "bg-rose/10 text-rose border-rose/30",
  draft: "bg-ink-800 text-haze-300 border-ink-600",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS[status] ?? STATUS.draft}`}>
      {["processing", "rendering", "running"].includes(status) && <Loader2 className="h-3 w-3 animate-spin" />}
      {status.replace("_", " ")}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div className="h-full rounded-full bg-gradient-to-r from-accent to-mint transition-all duration-500" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">{icon}</div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-haze-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="text-sm">{label}</span>
        {hint && <span className="block text-xs text-haze-500">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-ink-600"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(options) as T[]).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`chip ${value === k ? "chip-on" : "hover:border-ink-600"}`}>
          {options[k]}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-haze-400 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> {label ?? "Loading…"}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">{message}</div>;
}
