"""Clip renderer: cut -> remove silence -> reframe to 9:16 -> captions/overlays/audio -> H.264/AAC MP4."""
from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

from app.pipeline import reframe
from app.pipeline.captions import build_ass
from app.pipeline.media import MediaError, detect_silences, probe, run

log = logging.getLogger(__name__)
FONTS_DIR = "/usr/share/fonts"


@dataclass
class KeepSegment:
    src_start: float  # absolute source time
    src_end: float
    out_start: float  # time in rendered clip


def plan_segments(source: Path, start: float, end: float, edit: dict, has_audio: bool) -> list[KeepSegment]:
    """Segments of the source to keep. With silence removal, long pauses inside the clip are cut out."""
    if not (edit.get("remove_silence") and has_audio):
        return [KeepSegment(start, end, 0.0)]
    tmp = source.parent / f".sil_{start:.2f}.wav"
    try:
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(source),
             "-vn", "-ac", "1", "-ar", "16000", str(tmp)])
        silences = detect_silences(tmp, edit.get("silence_threshold_db", -35), edit.get("min_silence", 0.6))
    finally:
        tmp.unlink(missing_ok=True)
    pad = 0.15
    keep, cursor = [], 0.0
    clip_len = end - start
    for s0, s1 in silences:
        s0, s1 = s0 + pad, s1 - pad
        if s1 - s0 < 0.25:
            continue
        if s0 > cursor:
            keep.append((cursor, s0))
        cursor = max(cursor, s1)
    if cursor < clip_len:
        keep.append((cursor, clip_len))
    out, t = [], 0.0
    for a, b in keep:
        if b - a < 0.05:
            continue
        out.append(KeepSegment(start + a, start + b, t))
        t += b - a
    return out or [KeepSegment(start, end, 0.0)]


def map_words(words: list[dict], segments: list[KeepSegment]) -> list[dict]:
    """Translate source-time words into rendered-clip time, dropping words inside removed silence."""
    out = []
    for w in words:
        mid = (w["start"] + w["end"]) / 2
        for seg in segments:
            if seg.src_start <= mid <= seg.src_end:
                s = seg.out_start + max(w["start"], seg.src_start) - seg.src_start
                e = seg.out_start + min(w["end"], seg.src_end) - seg.src_start
                out.append({**w, "start": round(s, 3), "end": round(max(e, s + 0.05), 3)})
                break
    return out


def cut_source(source: Path, segments: list[KeepSegment], dst: Path, fps: int, has_audio: bool) -> None:
    """Extract kept segments into one constant-frame-rate intermediate (max 1080p tall/wide)."""
    scale = "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'"
    if len(segments) == 1:
        seg = segments[0]
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{seg.src_start:.3f}", "-to", f"{seg.src_end:.3f}",
               "-i", str(source), "-vf", f"{scale},fps={fps}", "-c:v", "libx264", "-preset", "veryfast",
               "-crf", "16"]
        cmd += ["-c:a", "aac", "-b:a", "256k"] if has_audio else ["-an"]
        run(cmd + [str(dst)])
        return
    base = segments[0].src_start
    span = segments[-1].src_end - base
    parts, labels = [], []
    for i, seg in enumerate(segments):
        a, b = seg.src_start - base, seg.src_end - base
        parts.append(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS[v{i}]")
        labels.append(f"[v{i}]")
        if has_audio:
            parts.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS[a{i}]")
            labels.append(f"[a{i}]")
    n = len(segments)
    parts.append("".join(labels) + f"concat=n={n}:v=1:a={1 if has_audio else 0}" +
                 ("[cv][ca]" if has_audio else "[cv]"))
    parts.append(f"[cv]{scale},fps={fps}[outv]")
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{base:.3f}", "-t", f"{span:.3f}", "-i", str(source),
           "-filter_complex", ";".join(parts), "-map", "[outv]"]
    cmd += ["-map", "[ca]", "-c:a", "aac", "-b:a", "256k"] if has_audio else ["-an"]
    run(cmd + ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", str(dst)])


# ---------------------------------------------------------------------------------------------
class Composer:
    """Builds each 9:16 output frame from a source frame according to the chosen layout."""

    def __init__(self, layout: str, src_w: int, src_h: int, out_w: int, out_h: int, track: reframe.FaceTrack,
                 edit: dict):
        self.layout = layout
        self.sw, self.sh, self.ow, self.oh = src_w, src_h, out_w, out_h
        self.edit = edit
        self.times = track.times
        cx, cy = reframe.speaker_path(track)
        self.cx = reframe.smooth_camera(cx) if cx.size else cx
        self.cy = reframe.smooth_camera(cy, dead_zone=0.08) if cy.size else cy
        self.split = reframe.two_speaker_centers(track) if layout == "split" else None
        if layout == "split" and not self.split:
            self.layout = "blur"  # split needs two people; fall back gracefully
        if layout == "face" and track.face_ratio < 0.15:
            self.layout = "blur" if src_w / src_h > 1.2 else "fill"  # no faces: show the whole frame
        self.no_faces = track.face_ratio < 0.15  # fill layout then holds a centred crop
        self.vertical_source = src_w / src_h <= 9 / 16 + 0.01

    def _crop(self, frame, cx: float, cy: float, crop_w: int, crop_h: int, out_w: int, out_h: int):
        x = int(np.clip(cx * self.sw - crop_w / 2, 0, max(self.sw - crop_w, 0)))
        y = int(np.clip(cy * self.sh - crop_h / 2, 0, max(self.sh - crop_h, 0)))
        roi = frame[y:y + crop_h, x:x + crop_w]
        return cv2.resize(roi, (out_w, out_h), interpolation=cv2.INTER_AREA)

    def _cover_crop_size(self, out_w: int, out_h: int, zoom: float = 1.0) -> tuple[int, int]:
        target = out_w / out_h
        if self.sw / self.sh > target:
            ch = int(self.sh / zoom)
            cw = int(ch * target)
        else:
            cw = int(self.sw / zoom)
            ch = int(cw / target)
        return max(cw, 2), max(ch, 2)

    def _blur_layout(self, frame):
        cw, ch = self._cover_crop_size(self.ow, self.oh)
        small = cv2.resize(frame, (max(self.sw // 8, 2), max(self.sh // 8, 2)))
        small = cv2.GaussianBlur(small, (0, 0), 6)
        bg = self._crop(cv2.resize(small, (self.sw, self.sh)), 0.5, 0.5, cw, ch, self.ow, self.oh)
        bg = (bg * 0.55).astype(np.uint8)
        fg_h = int(self.ow * self.sh / self.sw)
        fg = cv2.resize(frame, (self.ow, min(fg_h, self.oh)), interpolation=cv2.INTER_AREA)
        y = int((self.oh - fg.shape[0]) * 0.42)
        bg[y:y + fg.shape[0], :] = fg
        return bg

    def frame(self, frame, t: float, zoom: float = 1.0):
        if frame.shape[1] != self.sw or frame.shape[0] != self.sh:
            frame = cv2.resize(frame, (self.sw, self.sh))
        layout = self.layout
        if self.vertical_source and layout != "blur":
            out = cv2.resize(frame, (self.ow, self.oh), interpolation=cv2.INTER_AREA)
        elif layout == "blur":
            out = self._blur_layout(frame)
        elif layout == "split" and self.split:
            half = self.oh // 2
            cw, ch = self._cover_crop_size(self.ow, half, zoom=1.0)
            cy = reframe.interpolate(self.times, self.cy, t, 0.4) if self.cy.size else 0.4
            top = self._crop(frame, self.split[0], cy, cw, ch, self.ow, half)
            bottom = self._crop(frame, self.split[1], cy, cw, ch, self.ow, self.oh - half)
            out = np.vstack([top, bottom])
            cv2.line(out, (0, half), (self.ow, half), (20, 20, 20), max(self.oh // 400, 2))
        elif layout == "custom":
            cw, ch = self._cover_crop_size(self.ow, self.oh)
            out = self._crop(frame, float(self.edit.get("custom_crop_x", 0.5)), 0.5, cw, ch, self.ow, self.oh)
        else:  # fill / face
            face_zoom = float(self.edit.get("face_zoom", 1.0)) if layout == "face" else 1.0
            cw, ch = self._cover_crop_size(self.ow, self.oh, zoom=max(face_zoom, 1.0))
            cx = reframe.interpolate(self.times, self.cx, t) if self.cx.size and not self.no_faces else 0.5
            cy = reframe.interpolate(self.times, self.cy, t, 0.4) if self.cy.size else 0.5
            out = self._crop(frame, cx, cy if face_zoom > 1.0 else 0.5, cw, ch, self.ow, self.oh)
        if zoom > 1.001:
            zw, zh = int(self.ow / zoom), int(self.oh / zoom)
            x0, y0 = (self.ow - zw) // 2, int((self.oh - zh) * 0.4)
            out = cv2.resize(out[y0:y0 + zh, x0:x0 + zw], (self.ow, self.oh), interpolation=cv2.INTER_LINEAR)
        return out


def zoom_curve(words: list[dict], emphasis: list[str], strength: float):
    """Punch-in zoom around emphasised words: eases in over 0.25s, holds, eases out."""
    import re as _re
    keys = {_re.sub(r"[^\w%$]", "", e.lower()) for e in emphasis if e}
    hits = [w for w in words if _re.sub(r"[^\w%$]", "", w["word"].lower()) in keys]
    windows, last = [], -10.0
    for w in hits:
        if w["start"] - last > 2.5:  # don't zoom too often
            windows.append((w["start"] - 0.1, w["end"] + 0.6))
            last = w["start"]

    def at(t: float) -> float:
        for a, b in windows:
            if a - 0.25 <= t <= b + 0.25:
                if t < a:
                    k = (t - (a - 0.25)) / 0.25
                elif t > b:
                    k = 1 - (t - b) / 0.25
                else:
                    k = 1.0
                k = k * k * (3 - 2 * k)
                return 1.0 + strength * k
        return 1.0
    return at


ProgressFn = Callable[[float], None]


def render_clip(source: Path, start: float, end: float, words: list[dict], edit: dict, out_path: Path,
                work: Path, *, hook: str = "", emphasis: list[str] | None = None,
                music_path: Path | None = None, voiceover_path: Path | None = None,
                progress: ProgressFn = lambda p: None) -> dict:
    work.mkdir(parents=True, exist_ok=True)
    info = probe(source)
    has_audio = info["has_audio"]
    fps = int(edit.get("fps", 30))
    out_w, out_h = (int(x) for x in str(edit.get("resolution", "1080x1920")).split("x"))
    start = max(0.0, start + float(edit.get("trim_start_offset", 0.0)))
    end = min(info["duration"] or end, end + float(edit.get("trim_end_offset", 0.0)))
    if end - start < 1.0:
        raise MediaError("Clip is shorter than one second after trimming.")

    segments = plan_segments(source, start, end, edit, has_audio)
    progress(0.05)
    cut = work / "cut.mp4"
    cut_source(source, segments, cut, fps, has_audio)
    progress(0.15)

    clip_words = map_words(words, segments)
    cut_info = probe(cut)
    duration = cut_info["duration"]

    track = reframe.analyze_faces(cut, sample_fps=4.0)
    progress(0.25)
    composer = Composer(edit.get("layout", "face"), cut_info["width"], cut_info["height"], out_w, out_h, track,
                        edit)

    ass = build_ass(clip_words, edit.get("captions", {}), out_w, out_h, emphasis=emphasis,
                    hook=hook if edit.get("hook_overlay") else None,
                    hook_seconds=float(edit.get("hook_overlay_seconds", 2.5)),
                    overlays=edit.get("text_overlays", []), duration=duration)
    (work / "subs.ass").write_text(ass, encoding="utf-8")

    zoom_at = zoom_curve(clip_words, emphasis or [], float(edit.get("zoom_strength", 0.08))) \
        if edit.get("zoom_on_emphasis") else (lambda t: 1.0)

    # Encoder: raw frames on stdin + audio from the cut + optional music/voiceover.
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{out_w}x{out_h}",
           "-r", str(fps), "-i", "-"]
    inputs = 1
    audio_labels = []
    filters = [f"[0:v]ass=subs.ass:fontsdir={FONTS_DIR},format=yuv420p[v]"]
    if has_audio:
        cmd += ["-i", str(cut)]
        filters.append(f"[{inputs}:a]volume={float(edit.get('voice_volume', 1.0)):.2f}[voice]")
        audio_labels.append("[voice]")
        inputs += 1
    if voiceover_path and edit.get("voiceover"):
        vo = edit["voiceover"]
        cmd += ["-i", str(voiceover_path)]
        delay = int(float(vo.get("start", 0)) * 1000)
        filters.append(f"[{inputs}:a]adelay={delay}|{delay},volume={float(vo.get('volume', 1.0)):.2f}[vo]")
        audio_labels.append("[vo]")
        inputs += 1
    if music_path and edit.get("music"):
        cmd += ["-stream_loop", "-1", "-i", str(music_path)]
        vol = float(edit["music"].get("volume", 0.15))
        filters.append(f"[{inputs}:a]volume={vol:.2f},atrim=0:{duration:.3f}[music]")
        if audio_labels:
            # Duck music under the voice so speech stays clear.
            filters.append(f"{audio_labels[0]}asplit=2[vkey][vmain]")
            filters.append("[music][vkey]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[ducked]")
            audio_labels[0] = "[vmain]"
            audio_labels.append("[ducked]")
        else:
            audio_labels.append("[music]")
        inputs += 1
    if len(audio_labels) > 1:
        filters.append("".join(audio_labels) + f"amix=inputs={len(audio_labels)}:duration=first:normalize=0[aout]")
        audio_map = "[aout]"
    elif audio_labels:
        audio_map = audio_labels[0]
    else:
        audio_map = None

    br = str(edit.get("video_bitrate", "8M"))
    cmd += ["-filter_complex", ";".join(filters), "-map", "[v]"]
    if audio_map:
        cmd += ["-map", audio_map, "-c:a", "aac", "-b:a", str(edit.get("audio_bitrate", "192k")), "-ar", "48000"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-b:v", br, "-maxrate", br,
            "-bufsize", _double(br), "-r", str(fps), "-movflags", "+faststart", "-t", f"{duration:.3f}",
            str(out_path.resolve())]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE, cwd=str(work))
    cap = cv2.VideoCapture(str(cut))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or int(duration * fps)
    i = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            t = i / fps
            proc.stdin.write(composer.frame(frame, t, zoom_at(t)).tobytes())
            i += 1
            if i % 30 == 0:
                progress(0.25 + 0.7 * min(i / max(total, 1), 1.0))
        proc.stdin.close()
    except BrokenPipeError:
        pass
    finally:
        cap.release()
    err = proc.stderr.read().decode(errors="ignore")
    if proc.wait() != 0:
        raise MediaError(f"ffmpeg encode failed: {err[-2000:]}")
    progress(1.0)
    shutil.rmtree(work, ignore_errors=True)
    return {"duration": duration, "width": out_w, "height": out_h, "layout_used": composer.layout,
            "segments": len(segments), "faces_detected_ratio": round(track.face_ratio, 2), "words": clip_words}


def _double(bitrate: str) -> str:
    num = "".join(c for c in bitrate if c.isdigit() or c == ".")
    unit = bitrate[len(num):]
    return f"{float(num) * 2:g}{unit}"
