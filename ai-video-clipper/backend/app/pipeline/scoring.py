"""Engagement scoring.

The score is an *estimate* of how engaging a clip is likely to be for short-form
audiences, built from ten criteria. It is not a prediction of virality.
"""
import re

CRITERIA = {
    "opening": ("Strength of the opening", 0.14),
    "curiosity": ("Curiosity", 0.11),
    "emotion": ("Emotional impact", 0.10),
    "information": ("Information value", 0.11),
    "storytelling": ("Storytelling quality", 0.08),
    "relevance": ("Audience relevance", 0.09),
    "clarity": ("Clarity without extra context", 0.11),
    "retention": ("Potential viewer retention", 0.09),
    "ending": ("Strength of the ending", 0.08),
    "completeness": ("Delivers a complete idea", 0.09),
}


def overall(breakdown: dict[str, float]) -> int:
    total = sum(w for _, w in CRITERIA.values())
    score = sum(float(breakdown.get(k, 0)) * w for k, (_, w) in CRITERIA.items()) / total
    return int(round(max(0.0, min(100.0, score))))


# --- Heuristic scorer (used without an LLM, and as a pre-filter for the LLM) ---

HOOK_OPENERS = re.compile(
    r"^(here'?s|the (secret|truth|problem|reason|biggest|number one)|nobody|most people|what if|why|how|"
    r"imagine|stop|never|i (was|used to|realized|learned)|let me tell|the one thing|did you know)", re.I)
CURIOSITY = re.compile(r"\b(secret|surprising|actually|truth|mistake|nobody|why|what if|turns out|"
                       r"the reason|hidden|crazy|insane|wrong)\b", re.I)
EMOTION = re.compile(r"\b(love|hate|scared|afraid|cried|amazing|incredible|terrible|worst|best|"
                     r"angry|proud|shocked|died|broke|fail(ed|ure)?|dream|never forget)\b", re.I)
STORY = re.compile(r"\b(when i|i remember|one day|years ago|story|so i|then|and then|that'?s when)\b", re.I)
INFO = re.compile(r"\b(\d[\d,.%$]*|percent|million|billion|step|because|means|the key|framework|rule)\b", re.I)
DANGLING_START = re.compile(r"^(and|but|so|or|because|which|that|also|like|um|uh|yeah)\b", re.I)
REFERENCE = re.compile(r"\b(he|she|they|it|this|that|those)\b", re.I)
FILLERS = re.compile(r"\b(um+|uh+|you know|i mean|kind of|sort of|like)\b", re.I)


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def heuristic_breakdown(text: str, duration: float, niche_keywords: list[str] | None = None) -> dict[str, float]:
    words = text.split()
    n = max(len(words), 1)
    first = " ".join(words[:14])
    last = " ".join(words[-14:])
    wps = n / max(duration, 1.0)
    fillers = len(FILLERS.findall(text)) / n

    opening = 45 + (30 if HOOK_OPENERS.search(first) else 0) + (12 if "?" in first else 0) \
        - (25 if DANGLING_START.search(first) else 0)
    curiosity = 40 + 12 * min(len(CURIOSITY.findall(text)), 4) + (8 if "?" in text else 0)
    emotion = 35 + 12 * min(len(EMOTION.findall(text)), 4) + 5 * text.count("!")
    information = 35 + 7 * min(len(INFO.findall(text)), 7)
    storytelling = 30 + 14 * min(len(STORY.findall(text)), 4)
    relevance = 50 + (6 * sum(1 for k in (niche_keywords or []) if k.lower() in text.lower()))
    clarity = 75 - (20 if DANGLING_START.search(first) else 0) \
        - (15 if REFERENCE.match(words[0] if words else "") else 0) - 120 * fillers
    retention = 50 + (15 if 2.2 <= wps <= 3.6 else -10) - 100 * fillers
    ending = 50 + (20 if re.search(r"[.!]$", last) else -15) + (10 if EMOTION.search(last) else 0)
    completeness = 55 + (20 if re.search(r"[.!?]$", text.strip()) else -20) \
        - (20 if DANGLING_START.search(first) else 0)
    return {k: round(_clamp(v), 1) for k, v in {
        "opening": opening, "curiosity": curiosity, "emotion": emotion, "information": information,
        "storytelling": storytelling, "relevance": relevance, "clarity": clarity, "retention": retention,
        "ending": ending, "completeness": completeness}.items()}
