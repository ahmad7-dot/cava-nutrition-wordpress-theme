import { Clock, Pencil, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { CRITERIA_LABEL, PLATFORM_LABEL, fmtTime, type Clip } from "@/lib/api";
import { ScoreBadge, StatusPill } from "./ui";

export function ClipCard({ clip, rank }: { clip: Clip; rank?: number }) {
  const top = Object.entries(clip.score_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <article className="card flex flex-col p-5 transition hover:border-ink-600">
      <div className="flex items-start gap-4">
        <ScoreBadge score={clip.score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-haze-500">
            {rank !== undefined && <span>#{rank}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(clip.start)}–{fmtTime(clip.end)} · {Math.round(clip.end - clip.start)}s</span>
          </div>
          <h3 className="mt-1 font-medium leading-snug">{clip.title}</h3>
        </div>
        <StatusPill status={clip.render_status} />
      </div>

      <div className="mt-4 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-sm">
        <span className="mr-1.5 text-xs font-medium uppercase tracking-wide text-accent-strong">Hook</span>{clip.hook}
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-haze-400">“{clip.transcript_text}”</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {top.map(([k, v]) => <span key={k} className="chip">{CRITERIA_LABEL[k] ?? k} {v}</span>)}
      </div>

      <div className="mt-4 space-y-1.5 text-xs text-haze-400">
        <p className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong" />{clip.reason}</p>
        <p className="flex gap-2"><Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />{clip.target_audience} · best on {PLATFORM_LABEL[clip.recommended_platform] ?? clip.recommended_platform}</p>
      </div>

      <div className="mt-auto pt-5">
        <Link href={`/clips/${clip.id}`} className="btn-ghost w-full"><Pencil className="h-4 w-4" /> Open in editor</Link>
      </div>
    </article>
  );
}
