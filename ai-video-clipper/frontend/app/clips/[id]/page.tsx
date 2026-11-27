"use client";
import {
  ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Mic, Music, Pause, Play, Plus, Redo2, RefreshCw, Sparkles, Trash2, Undo2, Wand2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Preview, type PreviewHandle } from "@/components/editor/Preview";
import { Timeline } from "@/components/editor/Timeline";
import { ErrorNote, Progress, ScoreBadge, Segmented, Spinner, StatusPill, Toggle } from "@/components/ui";
import {
  API, CRITERIA_LABEL, PLATFORM_LABEL, api, fmtTime, type Clip, type EditSettings, type Options, type Project, type Word,
} from "@/lib/api";

type Draft = Pick<Clip, "title" | "start" | "end" | "hook" | "caption" | "hashtags" | "emphasis_words" | "edit_settings">;
type Tab = "captions" | "layout" | "edit" | "hook" | "details";

const pickDraft = (c: Clip): Draft => ({
  title: c.title, start: c.start, end: c.end, hook: c.hook, caption: c.caption, hashtags: c.hashtags,
  emphasis_words: c.emphasis_words, edit_settings: c.edit_settings,
});

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const [clip, setClip] = useState<Clip | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [opts, setOpts] = useState<Options | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [past, setPast] = useState<Draft[]>([]);
  const [future, setFuture] = useState<Draft[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("captions");
  const [view, setView] = useState<"live" | "render">("live");
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [music, setMusic] = useState<{ file: string; title: string }[]>([]);
  const [hookBusy, setHookBusy] = useState(false);
  const preview = useRef<PreviewHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.get<Clip>(`/api/clips/${id}`);
        const [p, o, w, m] = await Promise.all([
          api.get<Project>(`/api/projects/${c.project_id}`), api.get<Options>("/api/options"),
          api.get<{ words: Word[] }>(`/api/clips/${id}/words?pad=20`), api.get<{ file: string; title: string }[]>("/api/music"),
        ]);
        setClip(c); setProject(p); setOpts(o); setWords(w.words); setMusic(m); setDraft(pickDraft(c)); setCurrent(c.start);
        if (c.render_status === "rendered") setView("render");
      } catch (e) { setError((e as Error).message); }
    })();
  }, [id]);

  // Poll while rendering
  useEffect(() => {
    if (!clip || !["queued", "rendering"].includes(clip.render_status)) return;
    const t = setTimeout(async () => {
      const c = await api.get<Clip>(`/api/clips/${id}`);
      setClip(c);
      if (c.render_status === "rendered") setView("render");
    }, 1500);
    return () => clearTimeout(t);
  }, [clip, id]);

  const save = useCallback((d: Draft) => {
    clearTimeout(saveTimer.current);
    setSaving("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const c = await api.send<Clip>(`/api/clips/${id}`, "PATCH", { ...d, replace_edit_settings: true });
        setClip(c);
        setSaving("saved");
      } catch (e) { setSaving("error"); setError((e as Error).message); }
    }, 600);
  }, [id]);

  const commit = useCallback((next: Draft) => {
    if (!draft) return;
    setPast((p) => [...p.slice(-80), draft]);
    setFuture([]);
    setDraft(next);
    save(next);
  }, [draft, save]);

  const undo = useCallback(() => {
    if (!past.length || !draft) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1)); setFuture([draft, ...future]); setDraft(prev); save(prev);
  }, [past, future, draft, save]);
  const redo = useCallback(() => {
    if (!future.length || !draft) return;
    const next = future[0];
    setFuture(future.slice(1)); setPast([...past, draft]); setDraft(next); save(next);
  }, [past, future, draft, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (e.key === " ") { e.preventDefault(); preview.current?.toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  if (error && !draft) return <ErrorNote message={error} />;
  if (!clip || !draft || !project || !opts) return <Spinner label="Loading editor…" />;

  const edit = draft.edit_settings;
  const setEdit = (patch: Partial<EditSettings>) => commit({ ...draft, edit_settings: { ...edit, ...patch } });
  const setCap = (patch: Partial<EditSettings["captions"]>) => setEdit({ captions: { ...edit.captions, ...patch } });
  const duration = project.metadata_json?.duration ?? draft.end + 30;
  const aspect = (project.metadata_json?.width ?? 16) / (project.metadata_json?.height ?? 9);
  const clipWords = words.filter((w) => w.start >= draft.start - 0.05 && w.end <= draft.end + 0.05);

  const render = async () => {
    clearTimeout(saveTimer.current);
    try {
      await api.send(`/api/clips/${id}`, "PATCH", { ...draft, replace_edit_settings: true });
      setClip(await api.send<Clip>(`/api/clips/${id}/render`, "POST"));
    } catch (e) { setError((e as Error).message); }
  };

  const regenerateHooks = async () => {
    setHookBusy(true);
    try { setClip(await api.send<Clip>(`/api/clips/${id}/hooks`, "POST")); } catch (e) { setError((e as Error).message); }
    setHookBusy(false);
  };

  const editWord = (w: Word, text: string) => {
    const overrides = [...(edit.word_overrides ?? []).filter((o) => Math.abs(o.start - w.start) > 0.005), { ...w, word: text }];
    setWords(words.map((x) => (x.start === w.start ? { ...x, word: text } : x)).filter((x) => x.word.trim()));
    setEdit({ word_overrides: overrides });
  };

  const uploadAsset = async (f: File) => {
    const form = new FormData();
    form.append("file", f);
    return api.send<{ key: string; filename: string }>("/api/assets", "POST", form);
  };

  const rendering = ["queued", "rendering"].includes(clip.render_status);
  const stale = clip.output_key && clip.render_status === "draft";

  return (
    <div className="-mt-2">
      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={`/projects/${clip.project_id}`} className="btn-ghost px-2.5"><ArrowLeft className="h-4 w-4" /></Link>
        <input className="min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none focus:underline decoration-ink-600" value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => commit(draft)} />
        <span className="text-xs text-haze-500">{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : saving === "error" ? "Save failed" : ""}</span>
        <button onClick={undo} disabled={!past.length} className="btn-ghost px-2.5" title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></button>
        <button onClick={redo} disabled={!future.length} className="btn-ghost px-2.5" title="Redo (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></button>
        <button onClick={render} disabled={rendering} className="btn-primary">
          {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {rendering ? `Rendering ${Math.round(clip.render_progress * 100)}%` : clip.output_key ? "Re-render" : "Render clip"}
        </button>
        {clip.output_key && <a href={`${API}/api/clips/${id}/download`} className="btn-ghost"><Download className="h-4 w-4" /> MP4</a>}
      </div>
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {clip.render_status === "failed" && <div className="mb-4"><ErrorNote message={`Render failed: ${clip.render_error}`} /></div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left: preview + timeline */}
        <div className="space-y-5">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <Segmented value={view} onChange={setView} options={{ live: "Live preview", render: "Final render" }} />
              <div className="flex items-center gap-3">
                <StatusPill status={clip.render_status} />
                <ScoreBadge score={clip.score} size="sm" />
              </div>
            </div>
            {view === "live" ? (
              <>
                <Preview ref={preview} src={`${API}/api/projects/${clip.project_id}/source`} start={draft.start} end={draft.end}
                  words={words} edit={edit} hook={draft.hook} emphasis={draft.emphasis_words} onTime={setCurrent} onPlayState={setPlaying} sourceAspect={aspect} />
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button onClick={() => preview.current?.toggle()} className="btn-ghost w-28">
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Play"}
                  </button>
                  <span className="text-xs tabular-nums text-haze-400">{fmtTime(Math.max(current - draft.start, 0))} / {fmtTime(draft.end - draft.start)}</span>
                </div>
                <p className="mt-2 text-center text-xs text-haze-500">Approximate preview. Silence removal, face tracking and zoom are applied in the render.</p>
              </>
            ) : clip.output_key ? (
              <div className="flex flex-col items-center">
                <video key={clip.rendered_at ?? ""} src={`${API}/api/clips/${id}/preview?v=${clip.rendered_at}`} controls playsInline className="h-[560px] rounded-2xl border border-ink-700 bg-black" />
                {stale && <p className="mt-3 text-xs text-amber">You've made edits since this render. Re-render to apply them.</p>}
              </div>
            ) : (
              <div className="flex h-[560px] flex-col items-center justify-center gap-3 text-sm text-haze-400">
                {rendering ? <><Loader2 className="h-6 w-6 animate-spin text-accent-strong" /> Rendering… <div className="w-48"><Progress value={clip.render_progress} /></div></> : "Render the clip to see the final result."}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-medium">Timeline</h3>
            <Timeline duration={duration} start={draft.start} end={draft.end} current={current} words={words} emphasis={draft.emphasis_words}
              overlays={[
                ...(edit.hook_overlay ? [{ start: 0, end: edit.hook_overlay_seconds, label: "Hook", color: "#FFFFFF" }] : []),
                ...edit.text_overlays.map((o) => ({ start: o.start, end: o.end, label: o.text, color: "#A497FF" })),
                ...edit.image_overlays.map((o) => ({ start: o.start, end: o.end, label: o.filename ?? "Image", color: "#34D399" })),
              ]}
              onSeek={(t) => { setView("live"); preview.current?.seek(t); setCurrent(t); }}
              onRange={(s, e, done) => (done ? commit({ ...draft, start: s, end: e }) : setDraft({ ...draft, start: s, end: e }))} />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Start (s)" value={draft.start} onChange={(v) => commit({ ...draft, start: v })} />
              <NumField label="End (s)" value={draft.end} onChange={(v) => commit({ ...draft, end: v })} />
              <button className="btn-ghost self-end" onClick={() => commit({ ...draft, start: clip.start, end: clip.end })}>Reset trim</button>
              <button className="btn-ghost self-end" onClick={() => { preview.current?.seek(draft.start); setView("live"); }}>Go to start</button>
            </div>
          </div>
        </div>

        {/* Right: panels */}
        <div className="card h-fit overflow-hidden">
          <div className="flex border-b border-ink-700 text-sm">
            {(["captions", "layout", "edit", "hook", "details"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 px-2 py-3 capitalize transition ${tab === t ? "border-b-2 border-accent text-haze-100" : "text-haze-400 hover:text-haze-100"}`}>{t}</button>
            ))}
          </div>
          <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto p-5">
            {tab === "captions" && <>
              <Toggle label="Animated captions" checked={edit.captions.enabled} onChange={(v) => setCap({ enabled: v })} />
              <div><label className="label">Style</label><Segmented value={edit.captions.style} options={opts.caption_styles} onChange={(v) => setCap({ style: v })} /></div>
              <div><label className="label">Position</label><Segmented value={edit.captions.position} options={{ top: "Top", middle: "Middle", lower: "Lower third" }} onChange={(v) => setCap({ position: v })} /></div>
              <div><label className="label">Font size: {edit.captions.font_size}</label>
                <input type="range" min={40} max={120} value={edit.captions.font_size} onChange={(e) => setCap({ font_size: +e.target.value })} className="w-full" /></div>
              <div><label className="label">Words on screen: {edit.captions.words_per_group}</label>
                <input type="range" min={1} max={7} value={edit.captions.words_per_group} onChange={(e) => setCap({ words_per_group: +e.target.value })} className="w-full" /></div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Text" value={edit.captions.primary_color} onChange={(v) => setCap({ primary_color: v })} />
                <ColorField label="Highlight" value={edit.captions.highlight_color} onChange={(v) => setCap({ highlight_color: v })} />
              </div>
              <Toggle label="UPPERCASE" checked={edit.captions.uppercase} onChange={(v) => setCap({ uppercase: v })} />
              <Toggle label="Emphasise keywords & numbers" checked={edit.captions.emphasize_keywords} onChange={(v) => setCap({ emphasize_keywords: v })} />
              <div>
                <label className="label">Keywords to emphasise</label>
                <input className="input" value={draft.emphasis_words.join(", ")}
                  onChange={(e) => setDraft({ ...draft, emphasis_words: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  onBlur={() => commit(draft)} placeholder="money, secret, 50%" />
              </div>
              <div>
                <label className="label">Edit caption words</label>
                <p className="mb-2 text-xs text-haze-500">Fix transcription mistakes. Clear a word to remove it.</p>
                <div className="flex max-h-56 flex-wrap gap-1 overflow-y-auto rounded-lg bg-ink-850 p-2">
                  {clipWords.map((w) => (
                    <input key={w.start} defaultValue={w.word} onBlur={(e) => e.target.value !== w.word && editWord(w, e.target.value)}
                      onFocus={() => { preview.current?.seek(w.start); setCurrent(w.start); }}
                      className="rounded bg-ink-800 px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-accent" style={{ width: `${Math.max(w.word.length, 2) + 2}ch` }} />
                  ))}
                </div>
              </div>
            </>}

            {tab === "layout" && <>
              <div><label className="label">Layout</label>
                <div className="grid gap-2">
                  {Object.entries(opts.layouts).map(([k, v]) => (
                    <button key={k} onClick={() => setEdit({ layout: k })} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${edit.layout === k ? "border-accent/60 bg-accent-soft" : "border-ink-700 hover:border-ink-600"}`}>
                      {v}{edit.layout === k && <Check className="h-4 w-4 text-accent-strong" />}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-haze-500">Face modes track the active speaker. If no face is found, the render falls back to the full frame.</p>
              </div>
              {edit.layout === "face" && <div><label className="label">Face zoom: {edit.face_zoom.toFixed(2)}×</label>
                <input type="range" min={1} max={1.8} step={0.05} value={edit.face_zoom} onChange={(e) => setEdit({ face_zoom: +e.target.value })} className="w-full" /></div>}
              {edit.layout === "custom" && <div><label className="label">Crop position: {Math.round(edit.custom_crop_x * 100)}%</label>
                <input type="range" min={0} max={1} step={0.01} value={edit.custom_crop_x} onChange={(e) => setEdit({ custom_crop_x: +e.target.value })} className="w-full" /></div>}
              <div><label className="label">Resolution</label><Segmented value={edit.resolution} options={{ "1080x1920": "1080 × 1920", "720x1280": "720 × 1280" }} onChange={(v) => setEdit({ resolution: v })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Frame rate</label>
                  <select className="input" value={edit.fps} onChange={(e) => setEdit({ fps: +e.target.value })}>{[24, 25, 30, 50, 60].map((f) => <option key={f}>{f}</option>)}</select></div>
                <div><label className="label">Video bitrate</label>
                  <select className="input" value={edit.video_bitrate} onChange={(e) => setEdit({ video_bitrate: e.target.value })}>{["4M", "6M", "8M", "12M", "16M"].map((b) => <option key={b}>{b}</option>)}</select></div>
              </div>
            </>}

            {tab === "edit" && <>
              <Toggle label="Remove silences & dead air" hint="Cuts pauses longer than the threshold" checked={edit.remove_silence} onChange={(v) => setEdit({ remove_silence: v })} />
              {edit.remove_silence && <div><label className="label">Minimum pause to cut: {edit.min_silence.toFixed(1)}s</label>
                <input type="range" min={0.3} max={2} step={0.1} value={edit.min_silence} onChange={(e) => setEdit({ min_silence: +e.target.value })} className="w-full" /></div>}
              <Toggle label="Punch-in zoom on key words" checked={edit.zoom_on_emphasis} onChange={(v) => setEdit({ zoom_on_emphasis: v })} />
              {edit.zoom_on_emphasis && <div><label className="label">Zoom strength: {Math.round(edit.zoom_strength * 100)}%</label>
                <input type="range" min={0.02} max={0.2} step={0.01} value={edit.zoom_strength} onChange={(e) => setEdit({ zoom_strength: +e.target.value })} className="w-full" /></div>}

              <div className="border-t border-ink-700 pt-4">
                <div className="mb-2 flex items-center justify-between"><label className="label mb-0">Text overlays</label>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEdit({ text_overlays: [...edit.text_overlays, { text: "New text", start: Math.max(current - draft.start, 0), end: Math.max(current - draft.start, 0) + 3, position: "top" }] })}><Plus className="h-3 w-3" /> Add</button></div>
                {edit.text_overlays.map((o, i) => (
                  <div key={i} className="mb-2 space-y-2 rounded-lg bg-ink-850 p-2">
                    <div className="flex gap-2">
                      <input className="input py-1.5" defaultValue={o.text} onBlur={(e) => setEdit({ text_overlays: edit.text_overlays.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                      <button className="btn-ghost px-2" onClick={() => setEdit({ text_overlays: edit.text_overlays.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <NumField label="From" value={o.start} onChange={(v) => setEdit({ text_overlays: edit.text_overlays.map((x, j) => (j === i ? { ...x, start: v } : x)) })} />
                      <NumField label="To" value={o.end} onChange={(v) => setEdit({ text_overlays: edit.text_overlays.map((x, j) => (j === i ? { ...x, end: v } : x)) })} />
                      <div><label className="label">Where</label><select className="input py-1.5" value={o.position} onChange={(e) => setEdit({ text_overlays: edit.text_overlays.map((x, j) => (j === i ? { ...x, position: e.target.value as "top" } : x)) })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-ink-700 pt-4">
                <div className="mb-2 flex items-center justify-between"><label className="label mb-0 flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Images & logos</label>
                  <label className="btn-ghost cursor-pointer px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Upload
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const a = await uploadAsset(f);
                      const t0 = Math.max(current - draft.start, 0);
                      setEdit({ image_overlays: [...edit.image_overlays, { key: a.key, filename: a.filename, start: t0, end: t0 + 3, x: 0.5, y: 0.3, width: 0.4 }] });
                    }} /></label></div>
                {edit.image_overlays.map((o, i) => {
                  const upd = (p: Partial<typeof o>) => setEdit({ image_overlays: edit.image_overlays.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                  return (
                    <div key={i} className="mb-2 space-y-2 rounded-lg bg-ink-850 p-2 text-xs">
                      <div className="flex items-center justify-between"><span className="truncate">{o.filename}</span>
                        <button className="btn-ghost px-2 py-1" onClick={() => setEdit({ image_overlays: edit.image_overlays.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button></div>
                      <div className="grid grid-cols-2 gap-2"><NumField label="From" value={o.start} onChange={(v) => upd({ start: v })} /><NumField label="To" value={o.end} onChange={(v) => upd({ end: v })} /></div>
                      <label className="label">Vertical position {Math.round(o.y * 100)}%</label><input type="range" min={0.05} max={0.95} step={0.01} value={o.y} onChange={(e) => upd({ y: +e.target.value })} className="w-full" />
                      <label className="label">Size {Math.round(o.width * 100)}%</label><input type="range" min={0.1} max={1} step={0.01} value={o.width} onChange={(e) => upd({ width: +e.target.value })} className="w-full" />
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-ink-700 pt-4">
                <label className="label flex items-center gap-1.5"><Music className="h-3.5 w-3.5" /> Background music (licensed library)</label>
                <select className="input" value={edit.music?.file ?? ""} onChange={(e) => setEdit({ music: e.target.value ? { file: e.target.value, volume: edit.music?.volume ?? 0.15 } : null })}>
                  <option value="">None</option>
                  {music.map((m) => <option key={m.file} value={m.file}>{m.title}</option>)}
                </select>
                {!music.length && <p className="mt-1 text-xs text-haze-500">Add tracks you hold a licence for to the server's music folder.</p>}
                {edit.music && <><label className="label mt-3">Music volume {Math.round(edit.music.volume * 100)}% (ducked under speech)</label>
                  <input type="range" min={0} max={0.6} step={0.01} value={edit.music.volume} onChange={(e) => setEdit({ music: { ...edit.music!, volume: +e.target.value } })} className="w-full" /></>}
              </div>

              <div className="border-t border-ink-700 pt-4">
                <label className="label">Voice volume {Math.round(edit.voice_volume * 100)}%</label>
                <input type="range" min={0} max={2} step={0.05} value={edit.voice_volume} onChange={(e) => setEdit({ voice_volume: +e.target.value })} className="w-full" />
                <div className="mt-3 flex items-center justify-between"><label className="label mb-0 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> Voiceover / commentary</label>
                  {edit.voiceover ? <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEdit({ voiceover: null })}><Trash2 className="h-3 w-3" /> Remove</button> : (
                    <label className="btn-ghost cursor-pointer px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Upload
                      <input type="file" accept="audio/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const a = await uploadAsset(f); setEdit({ voiceover: { key: a.key, filename: a.filename, start: 0, volume: 1 } }); }} /></label>)}
                </div>
                {edit.voiceover && <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className="col-span-2 truncate text-haze-400">{edit.voiceover.filename}</span>
                  <NumField label="Starts at" value={edit.voiceover.start} onChange={(v) => setEdit({ voiceover: { ...edit.voiceover!, start: v } })} />
                  <NumField label="Volume" value={edit.voiceover.volume} step={0.1} onChange={(v) => setEdit({ voiceover: { ...edit.voiceover!, volume: v } })} />
                </div>}
              </div>
            </>}

            {tab === "hook" && <>
              <Toggle label="Show hook as opening title" checked={edit.hook_overlay} onChange={(v) => setEdit({ hook_overlay: v })} />
              {edit.hook_overlay && <div><label className="label">Title duration: {edit.hook_overlay_seconds.toFixed(1)}s</label>
                <input type="range" min={1} max={5} step={0.5} value={edit.hook_overlay_seconds} onChange={(e) => setEdit({ hook_overlay_seconds: +e.target.value })} className="w-full" /></div>}
              <div><label className="label">Hook</label>
                <textarea className="input" rows={2} value={draft.hook} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} onBlur={() => commit(draft)} /></div>
              <div>
                <div className="mb-2 flex items-center justify-between"><label className="label mb-0">Alternatives</label>
                  <button onClick={regenerateHooks} disabled={hookBusy} className="btn-ghost px-2 py-1 text-xs">{hookBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Regenerate</button></div>
                <div className="space-y-2">
                  {clip.alt_hooks.map((h, i) => (
                    <button key={i} onClick={() => commit({ ...draft, hook: h.text })} className="w-full rounded-lg border border-ink-700 p-3 text-left text-sm hover:border-accent/50">
                      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-accent-strong">{h.style.replace("_", " ")}</span>{h.text}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-haze-500">Hooks should reflect what's actually said in the clip. Misleading hooks hurt trust and retention.</p>
              </div>
            </>}

            {tab === "details" && <>
              <div className="flex items-center gap-4">
                <ScoreBadge score={clip.score} size="lg" />
                <div className="text-xs text-haze-400">Estimated engagement score: an estimate based on the clip's content, not a prediction of views.</div>
              </div>
              <div className="space-y-2">
                {Object.entries(clip.score_breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 text-haze-400">{CRITERIA_LABEL[k] ?? k}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-ink-700"><div className="h-full rounded-full bg-accent" style={{ width: `${v}%` }} /></div>
                    <span className="w-6 text-right tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
              <Info label="Why this clip" value={clip.reason} />
              <Info label="Audience" value={clip.target_audience} />
              <Info label="Best platform" value={PLATFORM_LABEL[clip.recommended_platform] ?? clip.recommended_platform} />
              {clip.value_adds.length > 0 && <div><div className="label flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Suggested additions</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-haze-300">{clip.value_adds.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
              <div><label className="label">Caption / description</label>
                <textarea className="input" rows={4} value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} onBlur={() => commit(draft)} /></div>
              <div><label className="label">Hashtags</label>
                <input className="input" value={draft.hashtags.map((h) => `#${h}`).join(" ")}
                  onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(/\s+/).map((h) => h.replace(/^#/, "")).filter(Boolean) })} onBlur={() => commit(draft)} /></div>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step = 0.1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" step={step} min={0} key={value} defaultValue={Number(value.toFixed(2))} className="input py-1.5 tabular-nums"
        onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v !== value) onChange(v); }} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-2 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent" />
        <span className="font-mono text-xs uppercase text-haze-300">{value}</span>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="label">{label}</div><p className="text-sm text-haze-300">{value || "—"}</p></div>;
}
