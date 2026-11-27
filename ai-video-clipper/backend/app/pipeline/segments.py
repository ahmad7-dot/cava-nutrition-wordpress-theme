"""Transcript -> sentences -> candidate clip windows that start and end on sentence boundaries."""
import re
from dataclasses import dataclass, field

SENTENCE_END = re.compile(r"[.!?…]['\")\]]*$")
PAUSE_BREAK = 0.9  # seconds of silence that also ends a sentence


@dataclass
class Sentence:
    idx: int
    start: float
    end: float
    text: str
    words: list[dict] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return self.end - self.start


def all_words(transcript: dict) -> list[dict]:
    words = []
    for seg in transcript.get("segments", []):
        if seg.get("words"):
            words.extend(seg["words"])
        elif seg.get("text"):
            # No word timings: spread words evenly across the segment.
            toks = seg["text"].split()
            step = (seg["end"] - seg["start"]) / max(len(toks), 1)
            words.extend({"start": seg["start"] + i * step, "end": seg["start"] + (i + 1) * step, "word": t}
                         for i, t in enumerate(toks))
    return words


def build_sentences(transcript: dict, max_sentence_seconds: float = 20.0) -> list[Sentence]:
    words = all_words(transcript)
    sentences: list[Sentence] = []
    cur: list[dict] = []

    def flush():
        if cur:
            sentences.append(Sentence(len(sentences), cur[0]["start"], cur[-1]["end"],
                                      " ".join(w["word"] for w in cur).strip(), list(cur)))
            cur.clear()

    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        gap = (nxt["start"] - w["end"]) if nxt else 0
        too_long = cur[-1]["end"] - cur[0]["start"] > max_sentence_seconds and w["word"].endswith(",")
        if SENTENCE_END.search(w["word"]) or gap >= PAUSE_BREAK or too_long:
            flush()
    flush()
    return sentences


@dataclass
class Window:
    first: int  # sentence index (inclusive)
    last: int  # sentence index (inclusive)
    start: float
    end: float
    text: str

    @property
    def duration(self) -> float:
        return self.end - self.start


def candidate_windows(sentences: list[Sentence], target: float, tolerance: float = 0.35) -> list[Window]:
    """Every run of whole sentences whose duration lands within +-tolerance of target."""
    lo, hi = target * (1 - tolerance), target * (1 + tolerance)
    out = []
    for i in range(len(sentences)):
        for j in range(i, len(sentences)):
            dur = sentences[j].end - sentences[i].start
            if dur > hi:
                break
            if dur >= lo:
                out.append(Window(i, j, sentences[i].start, sentences[j].end,
                                  " ".join(s.text for s in sentences[i:j + 1])))
    return out


def window_for_range(sentences: list[Sentence], first: int, last: int) -> Window:
    first = max(0, min(first, len(sentences) - 1))
    last = max(first, min(last, len(sentences) - 1))
    return Window(first, last, sentences[first].start, sentences[last].end,
                  " ".join(s.text for s in sentences[first:last + 1]))


def words_in_range(transcript: dict, start: float, end: float) -> list[dict]:
    return [w for w in all_words(transcript) if w["end"] > start and w["start"] < end]


def effective_words(transcript: dict, start: float, end: float, overrides: list[dict] | None = None) -> list[dict]:
    """Transcript words in [start, end] with the user's caption edits applied.

    Overrides use absolute source times and replace the transcript word that starts at the same moment.
    An override with an empty `word` deletes that word. Because overrides are matched by time, they stay
    valid when the clip is re-trimmed.
    """
    words = words_in_range(transcript, start, end)
    if not overrides:
        return words
    by_start = {round(float(o["start"]), 2): o for o in overrides}
    out = []
    for w in words:
        o = by_start.get(round(float(w["start"]), 2))
        if o is None:
            out.append(w)
        elif str(o.get("word", "")).strip():
            out.append({**w, "word": str(o["word"]).strip()})
    return out
