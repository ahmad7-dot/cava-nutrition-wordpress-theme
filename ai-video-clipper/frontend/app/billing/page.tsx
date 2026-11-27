"use client";
import { PageHeader, Progress, Spinner } from "@/components/ui";
import { fmtBytes, type Dashboard } from "@/lib/api";
import { useApi } from "@/lib/hooks";

const PLANS = [
  { name: "Starter", price: "$0", minutes: 60, features: ["60 source minutes / month", "720p export", "Rule-based analysis"] },
  { name: "Creator", price: "$29", minutes: 600, features: ["600 source minutes / month", "1080p export", "AI analysis & hooks", "Brand kit"], current: true },
  { name: "Studio", price: "$99", minutes: 3000, features: ["3,000 source minutes / month", "Team seats", "Priority rendering", "API access"] },
];

export default function BillingPage() {
  const { data } = useApi<Dashboard>("/api/dashboard");
  if (!data) return <Spinner />;
  const used = data.time_saved_minutes; // placeholder until metering is wired to billing
  return (
    <>
      <PageHeader title="Subscription & usage" subtitle="Plans shown are placeholders. Connect a billing provider (e.g. Stripe) before launch." />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><div className="label">Videos processed</div><div className="text-2xl font-semibold">{data.videos_processed}</div></div>
        <div className="card p-5"><div className="label">Clips exported</div><div className="text-2xl font-semibold">{data.clips_rendered}</div></div>
        <div className="card p-5"><div className="label">Storage</div><div className="text-2xl font-semibold">{fmtBytes(data.storage_bytes)}</div>
          <div className="mt-3"><Progress value={Math.min(data.storage_bytes / (50 * 1024 ** 3), 1)} /></div><div className="mt-1 text-xs text-haze-500">of 50 GB</div></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`card p-6 ${p.current ? "border-accent/60 shadow-glow" : ""}`}>
            <div className="flex items-center justify-between"><h3 className="font-medium">{p.name}</h3>{p.current && <span className="chip chip-on">Current</span>}</div>
            <div className="mt-3 text-3xl font-semibold">{p.price}<span className="text-sm font-normal text-haze-500">/mo</span></div>
            <ul className="mt-4 space-y-2 text-sm text-haze-300">{p.features.map((f) => <li key={f}>• {f}</li>)}</ul>
            <button disabled className="btn-ghost mt-6 w-full">{p.current ? "Manage" : "Switch plan"}</button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-haze-500">Estimated minutes used this month: {used}</p>
    </>
  );
}
