"""FFmpeg / FFprobe helpers."""
import json
import re
import subprocess
from pathlib import Path

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}


class MediaError(RuntimeError):
    pass


def run(cmd: list[str], timeout: float | None = None) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise MediaError(f"{cmd[0]} failed: {proc.stderr[-2000:]}")
    return proc


def probe(path: Path) -> dict:
    out = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)])
    data = json.loads(out.stdout)
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
    if not video:
        raise MediaError("No video stream found. Is this a valid video file?")
    fps = 30.0
    rate = video.get("avg_frame_rate") or video.get("r_frame_rate") or "30/1"
    try:
        num, den = rate.split("/")
        fps = float(num) / float(den) if float(den) else 30.0
    except (ValueError, ZeroDivisionError):
        pass
    width, height = int(video.get("width", 0)), int(video.get("height", 0))
    rotation = 0
    for sd in video.get("side_data_list", []) or []:
        if "rotation" in sd:
            rotation = int(sd["rotation"])
    if abs(rotation) in (90, 270):
        width, height = height, width
    return {
        "duration": float(data["format"].get("duration", 0.0)),
        "width": width,
        "height": height,
        "fps": round(fps, 3),
        "video_codec": video.get("codec_name"),
        "audio_codec": audio.get("codec_name") if audio else None,
        "has_audio": audio is not None,
        "size_bytes": int(data["format"].get("size", 0)),
        "format": data["format"].get("format_name"),
    }


def extract_audio(src: Path, dst: Path) -> Path:
    """16 kHz mono WAV, the format Whisper expects."""
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
         str(dst)])
    return dst


_SIL_START = re.compile(r"silence_start: (-?[\d.]+)")
_SIL_END = re.compile(r"silence_end: (-?[\d.]+)")


def detect_silences(src: Path, threshold_db: float = -35, min_silence: float = 0.6) -> list[tuple[float, float]]:
    proc = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(src), "-af", f"silencedetect=noise={threshold_db}dB:d={min_silence}",
         "-f", "null", "-"], capture_output=True, text=True)
    silences, start = [], None
    for line in proc.stderr.splitlines():
        if m := _SIL_START.search(line):
            start = max(float(m.group(1)), 0.0)
        elif (m := _SIL_END.search(line)) and start is not None:
            silences.append((start, float(m.group(1))))
            start = None
    return silences


def detect_scenes(src: Path, max_seconds: float | None = None) -> list[float]:
    """Scene-cut timestamps via PySceneDetect (falls back to [] if unavailable)."""
    try:
        from scenedetect import ContentDetector, SceneManager, open_video
    except ImportError:
        return []
    try:
        video = open_video(str(src))
        manager = SceneManager()
        manager.add_detector(ContentDetector(threshold=27.0))
        manager.auto_downscale = True
        duration = None
        if max_seconds:
            duration = video.base_timecode + max_seconds
        manager.detect_scenes(video=video, end_time=duration, show_progress=False)
        return [round(start.get_seconds(), 2) for start, _ in manager.get_scene_list()[1:]]
    except Exception:  # scene detection is best-effort context
        return []
