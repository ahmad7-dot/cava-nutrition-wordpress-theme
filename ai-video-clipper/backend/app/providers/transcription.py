"""Speech-to-text providers. Output format (word-level timestamps):

{"language": "en", "segments": [{"start": 0.0, "end": 3.2, "text": "...",
  "words": [{"start": 0.0, "end": 0.4, "word": "Hello", "prob": 0.98}]}]}
"""
from pathlib import Path
from typing import Callable, Protocol

from app.core.config import get_settings

ProgressFn = Callable[[float], None]


class TranscriptionProvider(Protocol):
    name: str

    def transcribe(self, audio_path: Path, language: str | None, progress: ProgressFn) -> dict: ...


class FasterWhisperProvider:
    name = "faster-whisper"
    _model = None

    def _load(self):
        if FasterWhisperProvider._model is None:
            from faster_whisper import WhisperModel

            s = get_settings()
            FasterWhisperProvider._model = WhisperModel(s.whisper_model, device=s.whisper_device,
                                                        compute_type=s.whisper_compute_type)
        return FasterWhisperProvider._model

    def transcribe(self, audio_path: Path, language: str | None, progress: ProgressFn) -> dict:
        model = self._load()
        segments_iter, info = model.transcribe(
            str(audio_path),
            language=None if language in (None, "", "auto") else language,
            word_timestamps=True,
            vad_filter=True,
            beam_size=5,
        )
        duration = max(info.duration or 1.0, 1.0)
        segments = []
        for seg in segments_iter:
            words = [{"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word.strip(),
                      "prob": round(w.probability, 3)} for w in (seg.words or []) if w.word.strip()]
            segments.append({"start": round(seg.start, 3), "end": round(seg.end, 3),
                             "text": seg.text.strip(), "words": words})
            progress(min(seg.end / duration, 1.0))
        return {"language": info.language, "segments": segments}


class NullProvider:
    """Returns an empty transcript. Only for pipeline tests without a speech model."""

    name = "none"

    def transcribe(self, audio_path: Path, language: str | None, progress: ProgressFn) -> dict:
        progress(1.0)
        return {"language": language or "en", "segments": []}


def get_transcriber() -> TranscriptionProvider:
    name = get_settings().transcription_provider
    if name == "none":
        return NullProvider()
    return FasterWhisperProvider()
