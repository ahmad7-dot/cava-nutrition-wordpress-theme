import Link from "next/link";
import { Film } from "lucide-react";
import { fmtDuration, type Project } from "@/lib/api";
import { Progress, StatusPill } from "./ui";

export function ProjectRow({ p, niches }: { p: Project; niches?: Record<string, string> }) {
  return (
    <Link href={`/projects/${p.id}`} className="flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-ink-850">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-haze-400">
        <Film className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{p.title}</div>
        <div className="mt-0.5 text-xs text-haze-500">
          {niches?.[p.niche] ?? p.niche} · {fmtDuration(p.metadata_json?.duration)} · {p.clip_count} clips ·{" "}
          {new Date(p.created_at).toLocaleDateString()}
        </div>
        {["processing", "queued"].includes(p.status) && (
          <div className="mt-2 flex items-center gap-3">
            <Progress value={p.progress} />
            <span className="shrink-0 text-xs text-haze-400">{p.stage}</span>
          </div>
        )}
      </div>
      <StatusPill status={p.status} />
    </Link>
  );
}
