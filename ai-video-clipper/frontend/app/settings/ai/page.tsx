"use client";
import { useEffect, useState } from "react";
import { SettingsForm } from "@/components/SettingsForm";
import { PageHeader } from "@/components/ui";
import { api, type Options } from "@/lib/api";

const DEFAULTS = { default_niche: "podcast", default_clips: 5, default_min: 15, default_max: 60, faithful_hooks: true, auto_render_top: 0 };

export default function AISettingsPage() {
  const [opts, setOpts] = useState<Options | null>(null);
  useEffect(() => { api.get<Options>("/api/options").then(setOpts); }, []);
  return (
    <>
      <PageHeader title="AI settings" subtitle="How clips are found and written." />
      <div className="card mb-6 max-w-2xl p-5 text-sm">
        <div className="label">Analysis engine</div>
        {opts?.llm_provider === "anthropic" ? (
          <p className="text-haze-300">Claude reads the full transcript, picks moments, scores them on 10 criteria and writes hooks and captions.</p>
        ) : (
          <p className="text-amber">Running the rule-based fallback. Set <code className="rounded bg-ink-800 px-1">ANTHROPIC_API_KEY</code> on the backend for AI-powered clip selection.</p>
        )}
        <p className="mt-2 text-xs text-haze-500">Model and transcription settings are set with environment variables on the server (see README).</p>
      </div>
      <SettingsForm settingKey="ai" defaults={DEFAULTS}>
        {(v, set) => <>
          <div><label className="label">Default niche</label>
            <select className="input" value={v.default_niche} onChange={(e) => set({ default_niche: e.target.value })}>
              {opts && Object.entries(opts.niches).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label">Clips per video</label><input type="number" min={1} max={20} className="input" value={v.default_clips} onChange={(e) => set({ default_clips: +e.target.value })} /></div>
            <div><label className="label">Min length (s)</label><input type="number" min={5} className="input" value={v.default_min} onChange={(e) => set({ default_min: +e.target.value })} /></div>
            <div><label className="label">Max length (s)</label><input type="number" max={180} className="input" value={v.default_max} onChange={(e) => set({ default_max: +e.target.value })} /></div>
          </div>
          <p className="text-xs text-haze-500">Hooks and captions are always kept faithful to what the speaker says. This can't be turned off.</p>
        </>}
      </SettingsForm>
    </>
  );
}
