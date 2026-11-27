"use client";
import { Check, Copy, Download, FileText, PackageOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, ErrorNote, PageHeader, ScoreBadge, Segmented, Spinner } from "@/components/ui";
import { API, PLATFORM_LABEL, api, type Clip } from "@/lib/api";
import { useApi } from "@/lib/hooks";

type Meta = { title: string; description: string; caption: string; hashtags: string[]; suggested_post_time: string; video: Record<string, string | number> };

export default function ExportsPage() {
  const { data, error } = useApi<Clip[]>("/api/clips?rendered=true");
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Export Center" subtitle="Download finished clips with ready-to-paste titles, descriptions and hashtags. Nothing is posted automatically." />
      {data.length ? <div className="space-y-4">{data.map((c) => <ExportRow key={c.id} clip={c} />)}</div> : (
        <Empty icon={<PackageOpen className="h-5 w-5" />} title="No rendered clips yet" body="Open a clip in the editor and click Render. Finished files appear here."
          action={<Link href="/clips" className="btn-primary">Browse clips</Link>} />
      )}
    </>
  );
}

function ExportRow({ clip }: { clip: Clip }) {
  const [platform, setPlatform] = useState(clip.recommended_platform || "tiktok");
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => { api.get<Meta>(`/api/clips/${clip.id}/export?platform=${platform}`).then(setMeta); }, [clip.id, platform]);

  return (
    <article className="card grid gap-5 p-5 lg:grid-cols-[180px_minmax(0,1fr)]">
      <video src={`${API}/api/clips/${clip.id}/preview?v=${clip.rendered_at}`} controls playsInline className="aspect-[9/16] w-full rounded-xl border border-ink-700 bg-black" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-start gap-3">
          <ScoreBadge score={clip.score} size="sm" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">{clip.title}</h3>
            <p className="text-xs text-haze-500">{clip.project_title} · rendered {clip.rendered_at && new Date(clip.rendered_at).toLocaleString()}</p>
          </div>
          <a href={`${API}/api/clips/${clip.id}/download`} className="btn-primary"><Download className="h-4 w-4" /> MP4</a>
          <a href={`${API}/api/clips/${clip.id}/srt`} download={`${clip.id}.srt`} className="btn-ghost"><FileText className="h-4 w-4" /> SRT</a>
          <Link href={`/clips/${clip.id}`} className="btn-ghost">Edit</Link>
        </div>
        <div className="mt-4"><Segmented value={platform} onChange={setPlatform} options={PLATFORM_LABEL} /></div>
        {meta && <div className="mt-4 grid gap-3 md:grid-cols-2">
          <CopyBox label="Title" text={meta.title} />
          <CopyBox label="Hashtags" text={meta.hashtags.map((h) => `#${h}`).join(" ")} />
          <div className="md:col-span-2"><CopyBox label="Description" text={meta.description} multiline /></div>
          <div className="text-xs text-haze-500 md:col-span-2">
            {String(meta.video.resolution)} · {String(meta.video.fps)} fps · H.264 / AAC · {String(meta.video.bitrate)} ·
            {" "}Suggested posting time (optional): {meta.suggested_post_time || "—"}
          </div>
        </div>}
      </div>
    </article>
  );
}

function CopyBox({ label, text, multiline }: { label: string; text: string; multiline?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label mb-0">{label}</span>
        <button className="text-xs text-haze-400 hover:text-haze-100" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
          {done ? <span className="flex items-center gap-1 text-mint"><Check className="h-3 w-3" /> Copied</span> : <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</span>}
        </button>
      </div>
      <div className={`rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-haze-300 ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>{text}</div>
    </div>
  );
}
