"""Face detection, active-speaker estimation and smooth 9:16 camera paths.

Faces are detected with OpenCV's bundled Haar cascade (no model download). The
"active speaker" is estimated from mouth-region motion between samples; the
virtual camera follows it with a dead-zone and speed limit so it moves like a
human operator instead of jittering.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

_cascade = None


def _detector():
    global _cascade
    if _cascade is None:
        _cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _cascade


@dataclass
class Face:
    cx: float  # normalised 0..1
    cy: float
    w: float
    h: float
    activity: float = 0.0  # mouth-motion score (active speaker estimate)

    @property
    def area(self) -> float:
        return self.w * self.h


@dataclass
class FaceTrack:
    times: list[float]
    faces: list[list[Face]]
    width: int
    height: int

    @property
    def face_ratio(self) -> float:
        return sum(1 for f in self.faces if f) / max(len(self.faces), 1)

    @property
    def max_faces(self) -> int:
        counts = sorted(len(f) for f in self.faces)
        return counts[int(len(counts) * 0.8)] if counts else 0


def analyze_faces(video: Path, sample_fps: float = 4.0, start: float = 0.0, end: float | None = None) -> FaceTrack:
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    end_frame = int(end * fps) if end else total
    step = max(int(round(fps / sample_fps)), 1)
    scale = 480.0 / max(W, 1)
    times, faces = [], []
    prev_gray = None
    frame_idx = int(start * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    det = _detector()
    while frame_idx < end_frame:
        ok = cap.grab()
        if not ok:
            break
        if (frame_idx - int(start * fps)) % step == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            small = cv2.resize(frame, (int(W * scale), int(H * scale)))
            gray = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
            rects = det.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6,
                                         minSize=(max(int(gray.shape[1] * 0.05), 24),) * 2)
            found = []
            sh, sw = gray.shape
            for (x, y, w, h) in rects:
                activity = 0.0
                if prev_gray is not None:
                    my0, my1 = y + int(h * 0.62), min(y + h, sh)
                    mx0, mx1 = x + int(w * 0.25), x + int(w * 0.75)
                    a, b = gray[my0:my1, mx0:mx1], prev_gray[my0:my1, mx0:mx1]
                    if a.size and a.shape == b.shape:
                        activity = float(np.mean(cv2.absdiff(a, b)))
                found.append(Face((x + w / 2) / sw, (y + h / 2) / sh, w / sw, h / sh, activity))
            times.append(frame_idx / fps)
            faces.append(found)
            prev_gray = gray
        frame_idx += 1
    cap.release()
    return FaceTrack(times, faces, W, H)


def _pick_speaker(faces: list[Face], prev_cx: float | None) -> Face | None:
    if not faces:
        return None
    def score(f: Face) -> float:
        s = f.area * 4 + f.activity * 0.02
        if prev_cx is not None:
            s += max(0.0, 0.15 - abs(f.cx - prev_cx))  # stickiness: prefer the current subject
        return s
    return max(faces, key=score)


def speaker_path(track: FaceTrack) -> tuple[np.ndarray, np.ndarray]:
    """Per-sample (cx, cy) of the active speaker; gaps are held/filled."""
    cx, cy = [], []
    prev = None
    for fs in track.faces:
        f = _pick_speaker(fs, prev)
        if f:
            prev = f.cx
            cx.append(f.cx)
            cy.append(f.cy)
        else:
            cx.append(np.nan)
            cy.append(np.nan)
    return _fill(np.array(cx)), _fill(np.array(cy), default=0.4)


def _fill(arr: np.ndarray, default: float = 0.5) -> np.ndarray:
    if arr.size == 0:
        return arr
    if np.all(np.isnan(arr)):
        return np.full_like(arr, default)
    idx = np.arange(arr.size)
    ok = ~np.isnan(arr)
    return np.interp(idx, idx[ok], arr[ok])


def smooth_camera(values: np.ndarray, dead_zone: float = 0.06, max_speed: float = 0.04,
                  median: int = 5) -> np.ndarray:
    """Median filter + dead-zone + speed limit (in normalised units per sample)."""
    if values.size == 0:
        return values
    k = min(median, values.size if values.size % 2 else values.size - 1)
    if k >= 3:
        pad = k // 2
        padded = np.pad(values, pad, mode="edge")
        values = np.array([np.median(padded[i:i + k]) for i in range(values.size)])
    out = np.empty_like(values)
    cam = values[0]
    for i, v in enumerate(values):
        delta = v - cam
        if abs(delta) > dead_zone:
            cam += float(np.clip(delta - np.sign(delta) * dead_zone * 0.5, -max_speed, max_speed))
        out[i] = cam
    return out


def two_speaker_centers(track: FaceTrack) -> tuple[float, float] | None:
    """If the video consistently shows two people side by side, return their horizontal centres."""
    xs = [f.cx for fs in track.faces for f in fs]
    if len(xs) < 6 or track.max_faces < 2:
        return None
    data = np.float32(xs).reshape(-1, 1)
    _, labels, centers = cv2.kmeans(data, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.01),
                                    3, cv2.KMEANS_PP_CENTERS)
    a, b = sorted(float(c) for c in centers.flatten())
    if b - a < 0.2:
        return None
    return a, b


def interpolate(times: list[float], values: np.ndarray, t: float, default: float = 0.5) -> float:
    if not times:
        return default
    return float(np.interp(t, times, values))
