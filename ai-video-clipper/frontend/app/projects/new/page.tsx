"use client";
import { Check, Link2, ShieldCheck, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorNote, PageHeader, Progress, Spinner } from "@/components/ui";
import { api, uploadWithProgress, type Options, type Project } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const [opts, setOpts] = useState<Options | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("podcast");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram_reels", "youtube_shorts"]);
  const [clips, setClips] = useState(5);
  const [minD, setMinD] = useState(15);
  const [maxD, setMaxD] = useState(60);
  const [language, setLanguage] = useState("auto");
  const [rights, setRights] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    api.get<Options>("/api/options").then(setOpts).catch((e) => setError(e.message));
  }, []);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file && !url) return setError("Upload a video file or paste a link.");
    if (!rights || !confirmed) return setError("Please complete the rights declaration.");
    if (minD > maxD) return setError("Minimum duration must be less than maximum.");
    const form = new FormData();
    Object.entries({
      title: title || "Untitled project", niche, language, target_platforms: platforms.join(","),
      desired_clips: String(clips), min_duration: String(minD), max_duration: String(maxD),
      rights_basis: rights, rights_confirmed: String(confirmed), rights_notes: notes,
    }).forEach(([k, v]) => form.append(k, v));
    if (url) form.append("source_url", url);
    if (file) form.append("file", file);
    try {
      setProgress(0);
      const p = await uploadWithProgress<Project>("/api/projects", form, setProgress);
      router.push(`/projects/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  };

  if (!opts) return error ? <ErrorNote message={error} /> : <Spinner />;
  const isYouTube = /youtu\.?be/.test(url);

  return (
    <>
      <PageHeader title="New project" subtitle="Upload a long-form video and we'll find the strongest short-form moments." />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="card p-6">
            <h2 className="mb-4 font-medium">1. Video</h2>
            <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-accent bg-accent-soft" : "border-ink-600 hover:border-ink-500 hover:bg-ink-850"}`}>
              <UploadCloud className="mb-3 h-8 w-8 text-accent-strong" />
              {file ? (
                <>
                  <span className="font-medium">{file.name}</span>
                  <span className="mt-1 text-xs text-haze-400">{(file.size / 1024 / 1024).toFixed(1)} MB · click to change</span>
                </>
              ) : (
                <>
                  <span className="font-medium">Drop a video here or click to browse</span>
                  <span className="mt-1 text-xs text-haze-400">MP4, MOV, MKV, WEBM · up to 4 GB</span>
                </>
              )}
              <input type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm,.m4v"
                className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </label>

            <div className="mt-4">
              <label className="label flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Source link (optional)</label>
              <input className="input" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
              {isYouTube && (
                <p className="mt-2 text-xs text-haze-400">
                  We don't download from YouTube: its terms don't allow it. The link is saved for reference. Upload the original
                  file from your own records or YouTube Studio's download option to process it.
                </p>
              )}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="mb-4 font-medium">2. Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Title</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Episode 42 — Building in public" />
              </div>
              <div>
                <label className="label">Niche</label>
                <select className="input" value={niche} onChange={(e) => setNiche(e.target.value)}>
                  {Object.entries(opts.niches).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Language</label>
                <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {[["auto", "Auto-detect"], ["en", "English"], ["es", "Spanish"], ["pt", "Portuguese"], ["fr", "French"], ["de", "German"], ["hi", "Hindi"], ["ur", "Urdu"], ["ar", "Arabic"], ["ja", "Japanese"], ["ko", "Korean"], ["zh", "Chinese"], ["id", "Indonesian"], ["tr", "Turkish"], ["it", "Italian"], ["ru", "Russian"]].map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <h2 className="mb-4 font-medium">3. Output</h2>
            <label className="label">Target platforms</label>
            <div className="mb-5 flex flex-wrap gap-2">
              {Object.entries(opts.platforms).map(([k, v]) => {
                const on = platforms.includes(k);
                return (
                  <button type="button" key={k} onClick={() => setPlatforms(on ? platforms.filter((x) => x !== k) : [...platforms, k])}
                    className={`chip ${on ? "chip-on" : ""}`}>{on && <Check className="h-3 w-3" />}{v.label}</button>
                );
              })}
            </div>
            <label className="label">Number of clips: {clips}</label>
            <input type="range" min={1} max={20} value={clips} onChange={(e) => setClips(+e.target.value)} className="mb-5 w-full" />
            <label className="label">Clip length</label>
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={minD} onChange={(e) => setMinD(+e.target.value)}>
                {opts.durations.map((d) => <option key={d} value={d}>min {d}s</option>)}
              </select>
              <select className="input" value={maxD} onChange={(e) => setMaxD(+e.target.value)}>
                {opts.durations.map((d) => <option key={d} value={d}>max {d}s</option>)}
              </select>
            </div>
            <p className="mt-3 text-xs text-haze-500">We only return as many clips as the video genuinely supports.</p>
          </section>

          <section className="card p-6">
            <h2 className="mb-1 flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-mint" /> 4. Rights declaration</h2>
            <p className="mb-4 text-xs text-haze-400">Required. Only process content you have the right to edit and republish.</p>
            <div className="space-y-2">
              {Object.entries(opts.rights_bases).map(([k, v]) => (
                <label key={k} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition ${rights === k ? "border-accent/60 bg-accent-soft" : "border-ink-700 hover:border-ink-600"}`}>
                  <input type="radio" name="rights" checked={rights === k} onChange={() => setRights(k)} className="mt-0.5" />
                  {v}
                </label>
              ))}
            </div>
            <textarea className="input mt-3" rows={2} placeholder="Licence details or notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <label className="mt-3 flex cursor-pointer gap-3 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
              <span>I confirm the statement above is true and I'm responsible for how the resulting clips are used.</span>
            </label>
          </section>

          {error && <ErrorNote message={error} />}
          {progress !== null ? (
            <div className="card p-4">
              <div className="mb-2 text-sm">Uploading… {Math.round(progress * 100)}%</div>
              <Progress value={progress} />
            </div>
          ) : (
            <button type="submit" className="btn-primary w-full py-3">Analyse video</button>
          )}
        </div>
      </form>
    </>
  );
}
