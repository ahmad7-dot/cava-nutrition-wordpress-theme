"use client";
import { Clapperboard, Clock3, Film, FolderOpen, HardDrive, Layers, PlusCircle } from "lucide-react";
import Link from "next/link";
import { ProjectRow } from "@/components/ProjectRow";
import { Empty, ErrorNote, PageHeader, Progress, Spinner, StatCard } from "@/components/ui";
import { fmtBytes, type Dashboard } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function DashboardPage() {
  const { data, error } = useApi<Dashboard>("/api/dashboard", (d) => d.queue.length > 0, 3000);

  if (error) return <ErrorNote message={`Can't reach the API: ${error}. Is the backend running on port 8000?`} />;
  if (!data) return <Spinner />;
  const hours = Math.floor(data.time_saved_minutes / 60);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your content repurposing at a glance."
        actions={<Link href="/projects/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New project</Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Projects" value={data.total_projects} icon={<FolderOpen className="h-4 w-4" />} />
        <StatCard label="Videos processed" value={data.videos_processed} icon={<Film className="h-4 w-4" />} />
        <StatCard label="Clips generated" value={data.clips_generated} hint={`${data.clips_rendered} exported`} icon={<Clapperboard className="h-4 w-4" />} />
        <StatCard label="Editing time saved" value={hours ? `${hours}h ${data.time_saved_minutes % 60}m` : `${data.time_saved_minutes}m`} hint="Rough estimate" icon={<Clock3 className="h-4 w-4" />} />
        <StatCard label="Storage used" value={fmtBytes(data.storage_bytes)} icon={<HardDrive className="h-4 w-4" />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between px-3 pt-1">
            <h2 className="font-medium">Recent projects</h2>
            <Link href="/history" className="text-xs text-haze-400 hover:text-haze-100">View all</Link>
          </div>
          {data.recent_projects.length ? (
            data.recent_projects.map((p) => <ProjectRow key={p.id} p={p} />)
          ) : (
            <Empty icon={<Film className="h-5 w-5" />} title="No projects yet"
              body="Upload a long-form video you own and get ranked, captioned short clips."
              action={<Link href="/projects/new" className="btn-primary">Create your first project</Link>} />
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-medium"><Layers className="h-4 w-4 text-haze-400" /> Processing queue</h2>
          {data.queue.length ? (
            <ul className="space-y-4">
              {data.queue.map((j) => (
                <li key={j.id}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <Link href={j.clip_id ? `/clips/${j.clip_id}` : `/projects/${j.project_id}`} className="capitalize hover:text-accent-strong">
                      {j.kind === "analyze" ? "Analysing video" : "Rendering clip"}
                    </Link>
                    <span className="text-xs capitalize text-haze-400">{j.status}</span>
                  </div>
                  <Progress value={j.progress} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-haze-500">Nothing in the queue.</p>
          )}
        </section>
      </div>
    </>
  );
}
