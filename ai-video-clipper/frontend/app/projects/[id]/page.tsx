"use client";
import { AlertTriangle, Brain, Clapperboard, Eye, FileText, Film, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClipCard } from "@/components/ClipCard";
import { Empty, ErrorNote, PageHeader, Progress, Spinner, StatusPill } from "@/components/ui";
import { api, fmtDuration, uploadWithProgress, type Project } from "@/lib/api";
import { useApi } from "@/lib/hooks";

const STAGES = ["Reading video metadata", "Extracting audio", "Transcribing speech", "Detecting scenes",
  "Analysing faces and speakers", "Understanding the full video", "Building clips"];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: p, error, reload } = useApi<Project>(`/api/projects/${id}`,
    (d) => ["queued", "processing"].includes(d.status) || !!d.clips?.some((c) => ["queued", "rendering"].includes(c.render_status)));
  const [sort, setSort] = useState<"score" | "time">("score");
  const [upload, setUpload] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<{ segments: { start: number; text: string }[] } | null>(null);

  const clips = useMemo(() => {
    const list = [...(p?.clips ?? [])];
    return sort === "score" ? list.sort((a, b) => b.score - a.score) : list.sort((a, b) => a.start - b.start);
  }, [p, sort]);

  if (error) return <ErrorNote message={error} />;
  if (!p) return <Spinner />;

  const reanalyze = async () => {
    setActionError(null);
    try { await api.send(`/api/projects/${id}/reanalyze`, "POST"); reload(); } catch (e) { setActionError((e as Error).message); }
  };
  const remove = async () => {
    if (!confirm("Delete this project, its source video and all rendered clips?")) return;
    await api.send(`/api/projects/${id}`, "DELETE");
    router.push("/history");
  };
  const uploadFile = async (f?: File) => {
    if (!f) return;
    const form = new FormData();
    form.append("file", f);
    try {
      setUpload(0);
      await uploadWithProgress(`/api/projects/${id}/upload`, form, setUpload);
      setUpload(null);
      reload();
    } catch (e) { setActionError((e as Error).message); setUpload(null); }
  };
  const toggleTranscript = async () => {
    if (!transcript) setTranscript(await api.get(`/api/projects/${id}/transcript`));
    setShowTranscript(!showTranscript);
  };

  const a = p.analysis ?? {};
  const busy = ["queued", "processing"].includes(p.status);
  const stageIdx = STAGES.indexOf(p.stage);

  return (
    <>
      <PageHeader title={p.title}
        subtitle={`${fmtDuration(p.metadata_json?.duration)} · ${p.metadata_json?.width ?? "?"}×${p.metadata_json?.height ?? "?"} · created ${new Date(p.created_at).toLocaleString()}`}
        actions={<>
          <StatusPill status={p.status} />
          {p.source_url && <a href={p.source_url} target="_blank" rel="noreferrer" className="btn-ghost">Source link</a>}
          {["ready", "failed"].includes(p.status) && <button onClick={reanalyze} className="btn-ghost"><RefreshCw className="h-4 w-4" /> Re-analyse</button>}
          <button onClick={remove} className="btn-danger"><Trash2 className="h-4 w-4" /></button>
        </>} />

      {actionError && <div className="mb-4"><ErrorNote message={actionError} /></div>}

      {p.status === "awaiting_upload" && (
        <Empty icon={<UploadCloud className="h-5 w-5" />} title="Upload the original video"
          body="We saved your link but don't download from video platforms. Upload the file you're authorised to use to start the analysis."
          action={upload !== null ? <div className="w-64"><Progress value={upload} /></div> : (
            <label className="btn-primary cursor-pointer">Choose file
              <input type="file" accept="video/*" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} />
            </label>
          )} />
      )}

      {busy && (
        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium">{p.stage || "Queued"}</span>
            <span className="tabular-nums text-haze-400">{Math.round(p.progress * 100)}%</span>
          </div>
          <Progress value={p.progress} />
          <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((s, i) => (
              <li key={s} className={`flex items-center gap-2 text-xs ${i < stageIdx ? "text-mint" : i === stageIdx ? "text-haze-100" : "text-haze-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${i < stageIdx ? "bg-mint" : i === stageIdx ? "animate-pulse bg-accent" : "bg-ink-600"}`} />{s}
              </li>
            ))}
          </ol>
        </section>
      )}

      {p.status === "failed" && (
        <div className="card flex gap-3 border-rose/30 p-5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose" />
          <div><div className="font-medium">Analysis failed</div><p className="mt-1 text-sm text-haze-400">{p.error}</p></div>
        </div>
      )}

      {p.status === "ready" && (
        <>
          <section className="mb-8 grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-2 flex items-center gap-2 font-medium"><Brain className="h-4 w-4 text-accent-strong" /> Video analysis</h2>
              <p className="text-sm leading-relaxed text-haze-300">{a.summary}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">{a.topics?.map((t) => <span key={t} className="chip">{t}</span>)}</div>
              <button onClick={toggleTranscript} className="mt-4 inline-flex items-center gap-1.5 text-xs text-haze-400 hover:text-haze-100">
                <FileText className="h-3.5 w-3.5" /> {showTranscript ? "Hide" : "Show"} full transcript
              </button>
              {showTranscript && transcript && (
                <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto rounded-lg bg-ink-850 p-3 text-sm text-haze-300">
                  {transcript.segments.map((s, i) => (
                    <p key={i}><span className="mr-2 font-mono text-xs text-haze-500">{Math.floor(s.start / 60)}:{String(Math.floor(s.start % 60)).padStart(2, "0")}</span>{s.text}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="card grid grid-cols-2 gap-4 p-5 text-sm">
              <Fact icon={<Film />} label="Scenes" value={a.scene_count ?? 0} />
              <Fact icon={<FileText />} label="Sentences" value={a.sentence_count ?? 0} />
              <Fact icon={<Eye />} label="Faces on screen" value={`${Math.round((a.visual?.face_presence ?? 0) * 100)}%`} />
              <Fact icon={<Clapperboard />} label="Clips found" value={a.clips_found ?? 0} />
              <div className="col-span-2 text-xs text-haze-500">
                Language: {a.language ?? "?"} · Engine: {a.provider === "anthropic" ? "Claude" : "rule-based (add an API key for AI analysis)"}
                {a.visual?.two_person_layout && " · Two-person layout detected"}
              </div>
            </div>
          </section>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Generated clips <span className="text-haze-500">({clips.length})</span></h2>
            <div className="flex gap-1.5">
              <button onClick={() => setSort("score")} className={`chip ${sort === "score" ? "chip-on" : ""}`}>Best first</button>
              <button onClick={() => setSort("time")} className={`chip ${sort === "time" ? "chip-on" : ""}`}>Timeline order</button>
            </div>
          </div>
          <p className="mb-4 text-xs text-haze-500">{a.note}</p>
          {clips.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clips.map((c, i) => <ClipCard key={c.id} clip={c} rank={sort === "score" ? i + 1 : undefined} />)}
            </div>
          ) : (
            <Empty icon={<Clapperboard className="h-5 w-5" />} title="No strong clips found"
              body="The video didn't contain moments that work on their own at this length. Try a wider duration range and re-analyse."
              action={<Link href="/projects/new" className="btn-ghost">New project</Link>} />
          )}
        </>
      )}
    </>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-haze-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
