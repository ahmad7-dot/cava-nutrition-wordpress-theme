"use client";
import { SettingsForm } from "@/components/SettingsForm";
import { PageHeader } from "@/components/ui";

const DEFAULTS = { name: "", email: "", timezone: "UTC", notify_on_ready: true };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" subtitle="Single-workspace MVP. Add authentication (e.g. Auth.js or Clerk) before going multi-user." />
      <SettingsForm settingKey="account" defaults={DEFAULTS}>
        {(v, set) => <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={v.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={v.email} onChange={(e) => set({ email: e.target.value })} /></div>
          </div>
          <div><label className="label">Time zone (for posting-time suggestions)</label>
            <input className="input" value={v.timezone} onChange={(e) => set({ timezone: e.target.value })} placeholder="Europe/London" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.notify_on_ready} onChange={(e) => set({ notify_on_ready: e.target.checked })} /> Notify me when a project is ready</label>
        </>}
      </SettingsForm>
    </>
  );
}
