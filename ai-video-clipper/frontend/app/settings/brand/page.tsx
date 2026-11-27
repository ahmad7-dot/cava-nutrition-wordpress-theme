"use client";
import { SettingsForm } from "@/components/SettingsForm";
import { PageHeader } from "@/components/ui";

const DEFAULTS = { brand_name: "", font: "Inter", primary_color: "#FFFFFF", highlight_color: "#FFD60A", handle: "", outro_text: "" };

export default function BrandPage() {
  return (
    <>
      <PageHeader title="Brand settings" subtitle="Defaults applied to every new clip. You can still change them per clip." />
      <SettingsForm settingKey="brand" defaults={DEFAULTS}>
        {(v, set) => <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Brand name</label><input className="input" value={v.brand_name} onChange={(e) => set({ brand_name: e.target.value })} /></div>
            <div><label className="label">Social handle</label><input className="input" placeholder="@yourchannel" value={v.handle} onChange={(e) => set({ handle: e.target.value })} /></div>
          </div>
          <div><label className="label">Caption font</label>
            <select className="input" value={v.font} onChange={(e) => set({ font: e.target.value })}>
              {["Inter", "Inter Display", "DejaVu Sans"].map((f) => <option key={f}>{f}</option>)}
            </select>
            <p className="mt-1 text-xs text-haze-500">Fonts must be installed on the render server.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["primary_color", "highlight_color"] as const).map((k) => (
              <div key={k}><label className="label">{k === "primary_color" ? "Caption text colour" : "Highlight colour"}</label>
                <div className="flex items-center gap-2"><input type="color" value={v[k]} onChange={(e) => set({ [k]: e.target.value })} className="h-9 w-12 rounded border border-ink-700 bg-transparent" />
                  <input className="input font-mono" value={v[k]} onChange={(e) => set({ [k]: e.target.value })} /></div></div>
            ))}
          </div>
          <div className="rounded-xl border border-ink-700 bg-black p-6 text-center">
            <span className="text-2xl font-extrabold uppercase" style={{ fontFamily: v.font, color: v.primary_color, textShadow: "0 2px 0 #000" }}>
              This is <span style={{ color: v.highlight_color }}>your</span> caption
            </span>
          </div>
        </>}
      </SettingsForm>
    </>
  );
}
