"use client";
import { Check } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { ErrorNote, Spinner } from "./ui";

/** Loads /api/settings/{key}, lets children edit it, saves on submit. */
export function SettingsForm<T extends Record<string, unknown>>({ settingKey, defaults, children }: {
  settingKey: string; defaults: T; children: (v: T, set: (patch: Partial<T>) => void) => ReactNode;
}) {
  const [value, setValue] = useState<T | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Partial<T>>(`/api/settings/${settingKey}`).then((v) => setValue({ ...defaults, ...v })).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingKey]);

  if (error) return <ErrorNote message={error} />;
  if (!value) return <Spinner />;
  return (
    <form className="card max-w-2xl space-y-5 p-6" onSubmit={async (e) => {
      e.preventDefault();
      try { await api.send(`/api/settings/${settingKey}`, "PUT", { value }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
      catch (err) { setError((err as Error).message); }
    }}>
      {children(value, (patch) => setValue({ ...value, ...patch }))}
      <div className="flex items-center gap-3 border-t border-ink-700 pt-5">
        <button type="submit" className="btn-primary">Save changes</button>
        {saved && <span className="flex items-center gap-1 text-sm text-mint"><Check className="h-4 w-4" /> Saved</span>}
      </div>
    </form>
  );
}
