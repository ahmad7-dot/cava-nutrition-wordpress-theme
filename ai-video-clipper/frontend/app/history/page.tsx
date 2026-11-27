"use client";
import { FolderClock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProjectRow } from "@/components/ProjectRow";
import { Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { api, type Options, type Project } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function HistoryPage() {
  const { data, error } = useApi<Project[]>("/api/projects", (d) => d.some((p) => ["queued", "processing"].includes(p.status)), 3000);
  const [niches, setNiches] = useState<Record<string, string>>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  useEffect(() => { api.get<Options>("/api/options").then((o) => setNiches(o.niches)); }, []);
  const list = useMemo(() => (data ?? []).filter((p) => (status === "all" || p.status === status) && p.title.toLowerCase().includes(q.toLowerCase())), [data, q, status]);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Project history" subtitle={`${data.length} projects`} actions={<Link href="/projects/new" className="btn-primary">New project</Link>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input className="input sm:max-w-xs" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {["all", "ready", "processing", "awaiting_upload", "failed"].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`chip capitalize ${status === s ? "chip-on" : ""}`}>{s.replace("_", " ")}</button>
          ))}
        </div>
      </div>
      {list.length ? <div className="card p-2">{list.map((p) => <ProjectRow key={p.id} p={p} niches={niches} />)}</div> : (
        <Empty icon={<FolderClock className="h-5 w-5" />} title="Nothing here" body="No projects match these filters." />
      )}
    </>
  );
}
