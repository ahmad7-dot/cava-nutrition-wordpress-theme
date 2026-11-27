"use client";
import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipCard } from "@/components/ClipCard";
import { Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import type { Clip } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function ClipsPage() {
  const { data, error } = useApi<Clip[]>("/api/clips");
  const [min, setMin] = useState(0);
  const [q, setQ] = useState("");
  const list = useMemo(() => (data ?? []).filter((c) => c.score >= min &&
    (!q || `${c.title} ${c.transcript_text} ${c.project_title}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.score - a.score), [data, min, q]);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Generated clips" subtitle="Every clip across your projects, best first." />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input className="input sm:max-w-xs" placeholder="Search titles and transcripts" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1.5">
          {[0, 60, 75, 85].map((m) => <button key={m} onClick={() => setMin(m)} className={`chip ${min === m ? "chip-on" : ""}`}>{m ? `${m}+` : "All scores"}</button>)}
        </div>
      </div>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((c) => <ClipCard key={c.id} clip={c} />)}</div>
      ) : (
        <Empty icon={<Clapperboard className="h-5 w-5" />} title="No clips yet" body="Create a project to generate clips."
          action={<Link href="/projects/new" className="btn-primary">New project</Link>} />
      )}
    </>
  );
}
