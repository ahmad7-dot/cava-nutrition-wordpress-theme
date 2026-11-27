"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { EditSettings, Word } from "@/lib/api";

export type PreviewHandle = { seek: (t: number) => void; toggle: () => void };

type Props = {
  src: string;
  start: number;
  end: number;
  words: Word[];
  edit: EditSettings;
  hook: string;
  emphasis: string[];
  onTime: (t: number) => void;
  onPlayState: (playing: boolean) => void;
  sourceAspect: number; // width / height
};

const SENT_END = /[.!?…]$/;

function groupWords(words: Word[], per: number) {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (cur.length >= per || SENT_END.test(w.word) || (next && next.start - w.end > 0.5)) { groups.push(cur); cur = []; }
  });
  if (cur.length) groups.push(cur);
  return groups;
}

/**
 * Live approximation of the final 9:16 render (layout, captions, hook card, overlays).
 * Silence removal, zoom punch-ins and face tracking are applied only in the real render.
 */
export const Preview = forwardRef<PreviewHandle, Props>(function Preview(
  { src, start, end, words, edit, hook, emphasis, onTime, onPlayState, sourceAspect }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const bg = useRef<HTMLVideoElement>(null);
  const timeRef = useRef(start);

  useImperativeHandle(ref, () => ({
    seek: (t: number) => { if (video.current) video.current.currentTime = t; if (bg.current) bg.current.currentTime = t; },
    toggle: () => {
      const v = video.current;
      if (!v) return;
      if (v.paused) { if (v.currentTime < start || v.currentTime >= end) v.currentTime = start; v.play(); } else v.pause();
    },
  }), [start, end]);

  useEffect(() => {
    const v = video.current;
    if (v && (v.currentTime < start - 0.1 || v.currentTime > end)) v.currentTime = start;
  }, [start, end]);

  const cap = edit.captions;
  const groups = useMemo(() => groupWords(words.filter((w) => w.end > start && w.start < end), Math.max(1, cap.words_per_group)), [words, start, end, cap.words_per_group]);
  const emph = useMemo(() => new Set(emphasis.map((e) => e.toLowerCase().replace(/[^\w%$]/g, ""))), [emphasis]);

  const t = timeRef.current;
  const rel = t - start;
  const group = groups.find((g, i) => t >= g[0].start && t < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.15) && t <= g[g.length - 1].end + 0.15);
  const H = 560;
  const scale = H / 1920;

  const layout = edit.layout;
  const objectX = layout === "custom" ? edit.custom_crop_x * 100 : 50;
  const zoom = layout === "face" ? Math.max(edit.face_zoom, 1) : 1;
  const vertical = sourceAspect <= 9 / 16 + 0.01;
  const capStyle: React.CSSProperties = {
    fontFamily: `${cap.font}, Inter, sans-serif`,
    fontSize: cap.font_size * scale,
    fontWeight: cap.style === "minimal" ? 600 : 800,
    color: cap.primary_color,
    textTransform: cap.uppercase ? "uppercase" : "none",
    lineHeight: 1.15,
    textShadow: cap.style === "boxed" ? undefined : cap.style === "neon" ? `0 0 8px ${cap.highlight_color}` : "0 0 3px #000, 0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000",
    background: cap.style === "boxed" ? "rgba(0,0,0,0.62)" : undefined,
    padding: cap.style === "boxed" ? "2px 8px" : undefined,
    borderRadius: cap.style === "boxed" ? 4 : undefined,
  };
  const capPos: React.CSSProperties = cap.position === "top" ? { top: "16%" } : cap.position === "middle" ? { top: "50%", transform: "translateY(-50%)" } : { bottom: "24%" };

  return (
    <div className="relative mx-auto overflow-hidden rounded-2xl border border-ink-700 bg-black shadow-glow" style={{ height: H, width: (H * 9) / 16 }}>
      {layout === "blur" && !vertical && (
        <video ref={bg} src={src} muted playsInline className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
      )}
      <video ref={video} src={src} playsInline preload="metadata"
        className={`absolute ${layout === "blur" && !vertical ? "left-0 top-[42%] w-full -translate-y-1/2" : "inset-0 h-full w-full object-cover"}`}
        style={layout === "blur" && !vertical ? {} : { objectPosition: `${objectX}% 50%`, transform: `scale(${zoom})` }}
        onTimeUpdate={(e) => {
          const ct = e.currentTarget.currentTime;
          timeRef.current = ct;
          if (bg.current && Math.abs(bg.current.currentTime - ct) > 0.3) bg.current.currentTime = ct;
          if (ct >= end) { e.currentTarget.pause(); e.currentTarget.currentTime = start; }
          onTime(ct);
        }}
        onPlay={() => { bg.current?.play(); onPlayState(true); }}
        onPause={() => { bg.current?.pause(); onPlayState(false); }} />

      {layout === "split" && <div className="absolute inset-x-0 top-1/2 h-0.5 bg-ink-900" title="Split screen is applied in the render when two people are detected" />}

      {edit.hook_overlay && hook && rel >= 0 && rel < edit.hook_overlay_seconds && (
        <div className="absolute inset-x-[10%] top-[12%] flex justify-center">
          <span className="rounded bg-white px-2 py-1 text-center font-bold text-[#111]" style={{ fontSize: 62 * scale }}>{hook}</span>
        </div>
      )}

      {edit.text_overlays.filter((o) => rel >= o.start && rel <= o.end).map((o, i) => (
        <div key={i} className="absolute inset-x-[8%] text-center font-bold text-white"
          style={{ fontSize: 56 * scale, textShadow: "0 0 3px #000", ...(o.position === "top" ? { top: "30%" } : o.position === "middle" ? { top: "50%" } : { bottom: "12%" }) }}>{o.text}</div>
      ))}

      {cap.enabled && group && (
        <div className="absolute inset-x-[8%] flex justify-center text-center" style={capPos}>
          <span style={capStyle}>
            {group.map((w, i) => {
              const active = t >= w.start && (i === group.length - 1 || t < group[i + 1].start);
              const isEmph = cap.emphasize_keywords && (emph.has(w.word.toLowerCase().replace(/[^\w%$]/g, "")) || /\d/.test(w.word));
              return (
                <span key={i} style={{ color: active || isEmph ? cap.highlight_color : undefined, display: "inline-block",
                  transform: active && ["bold_pop", "neon"].includes(cap.style) ? "scale(1.08)" : undefined, margin: "0 0.12em" }}>{w.word}</span>
              );
            })}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[11%] border-t border-dashed border-white/10" title="Platform UI safe zone" />
      <div className="pointer-events-none absolute bottom-[11%] right-0 top-[45%] w-[14%] border-l border-dashed border-white/10" title="Platform UI safe zone" />
    </div>
  );
});
