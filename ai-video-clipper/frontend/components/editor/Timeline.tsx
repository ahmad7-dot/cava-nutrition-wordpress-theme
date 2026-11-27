"use client";
import { useRef } from "react";
import { fmtTime, type Word } from "@/lib/api";

type Props = {
  duration: number; // source duration
  start: number;
  end: number;
  current: number;
  words: Word[];
  emphasis: string[];
  overlays: { start: number; end: number; label: string; color: string }[]; // clip-relative
  onSeek: (t: number) => void;
  onRange: (start: number, end: number, done: boolean) => void;
};

const PAD = 15;

/** Zoomed timeline around the clip: drag the handles to trim, click to seek. */
export function Timeline({ duration, start, end, current, words, emphasis, overlays, onSeek, onRange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const viewStart = Math.max(0, start - PAD);
  const viewEnd = Math.min(duration || end + PAD, end + PAD);
  const span = Math.max(viewEnd - viewStart, 1);
  const pct = (t: number) => `${((t - viewStart) / span) * 100}%`;
  const emph = new Set(emphasis.map((e) => e.toLowerCase().replace(/[^\w%$]/g, "")));

  const timeAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return viewStart + Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * span;
  };

  const drag = (which: "start" | "end" | "move") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const origin = timeAt(e.clientX);
    const s0 = start, e0 = end;
    let last = { s: s0, e: e0 };
    const move = (ev: PointerEvent) => {
      const t = timeAt(ev.clientX);
      let s = s0, en = e0;
      if (which === "start") s = Math.min(Math.max(0, t), e0 - 1);
      else if (which === "end") en = Math.max(Math.min(duration || t, t), s0 + 1);
      else {
        const d = t - origin;
        s = Math.max(0, s0 + d);
        en = s + (e0 - s0);
        if (duration && en > duration) { en = duration; s = en - (e0 - s0); }
      }
      last = { s: Math.round(s * 100) / 100, e: Math.round(en * 100) / 100 };
      onRange(last.s, last.e, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onRange(last.s, last.e, true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const ticks: number[] = [];
  const step = span > 120 ? 30 : span > 60 ? 10 : 5;
  for (let t = Math.ceil(viewStart / step) * step; t <= viewEnd; t += step) ticks.push(t);

  return (
    <div className="select-none">
      <div className="relative mb-1 h-4 text-[10px] text-haze-500">
        {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(t) }}>{fmtTime(t)}</span>)}
      </div>
      <div ref={ref} className="relative h-24 cursor-pointer overflow-hidden rounded-lg border border-ink-700 bg-ink-850"
        onPointerDown={(e) => onSeek(timeAt(e.clientX))}>
        {/* word blocks */}
        <div className="absolute inset-x-0 top-2 h-7">
          {words.map((w, i) => (
            <div key={i} title={w.word}
              className={`absolute top-0 h-full overflow-hidden rounded-sm px-0.5 text-[9px] leading-7 ${w.start >= start && w.end <= end ? (emph.has(w.word.toLowerCase().replace(/[^\w%$]/g, "")) ? "bg-amber/40 text-white" : "bg-accent/30 text-haze-100") : "bg-ink-700 text-haze-500"}`}
              style={{ left: pct(w.start), width: `calc(${((w.end - w.start) / span) * 100}% - 1px)` }}>{w.word}</div>
          ))}
        </div>
        {/* overlays lane */}
        <div className="absolute inset-x-0 top-11 h-4">
          {overlays.map((o, i) => (
            <div key={i} className="absolute h-full truncate rounded-sm px-1 text-[9px] leading-4 text-black"
              style={{ left: pct(start + o.start), width: `${((o.end - o.start) / span) * 100}%`, background: o.color }}>{o.label}</div>
          ))}
        </div>
        {/* dimmed outside the selection */}
        <div className="pointer-events-none absolute inset-y-0 left-0 bg-ink-950/60" style={{ width: pct(start) }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 bg-ink-950/60" style={{ left: pct(end) }} />
        {/* selection */}
        <div className="absolute inset-y-0 cursor-grab border-y-2 border-accent active:cursor-grabbing" style={{ left: pct(start), width: `${((end - start) / span) * 100}%` }}
          onPointerDown={drag("move")} />
        {(["start", "end"] as const).map((h) => (
          <div key={h} onPointerDown={drag(h)} className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize"
            style={{ left: pct(h === "start" ? start : end) }}>
            <div className="mx-auto h-full w-1.5 rounded bg-accent" />
          </div>
        ))}
        {/* playhead */}
        <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white" style={{ left: pct(current) }}>
          <div className="-ml-1 h-2 w-2 rounded-full bg-white" />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs tabular-nums text-haze-400">
        <span>In {fmtTime(start)}</span><span>{(end - start).toFixed(1)}s selected</span><span>Out {fmtTime(end)}</span>
      </div>
    </div>
  );
}
