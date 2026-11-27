import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_TMP = Path(os.environ.get("CLIPPER_TEST_DIR", "/tmp/clipper-test"))
os.environ.setdefault("CLIPPER_DATA_DIR", str(_TMP / "data"))
os.environ.setdefault("CLIPPER_DATABASE_URL", f"sqlite:///{_TMP}/test.db")
os.environ["CLIPPER_LLM_PROVIDER"] = "heuristic"
os.environ["CLIPPER_TRANSCRIPTION_PROVIDER"] = "none"
_TMP.mkdir(parents=True, exist_ok=True)
(_TMP / "test.db").unlink(missing_ok=True)

SENTENCES = [
    "Here's the secret most people never learn about building a business.",
    "When I started my first company I made every mistake you can imagine.",
    "We spent two million dollars on ads before we had a single loyal customer.",
    "That was the biggest failure of my life, and it taught me one rule.",
    "Talk to fifty customers before you write a single line of code.",
    "Why does this work so well?",
    "Because customers tell you exactly what they will pay for, if you listen.",
    "Most founders skip this step because it feels slow.",
    "But it is actually the fastest way to find product market fit.",
    "So my advice is simple: listen first, build second, and sell third.",
    "One day a customer told me our product was confusing and I was shocked.",
    "Then I realized she was right, and we rebuilt the whole onboarding in a week.",
    "Our retention doubled in a month.",
]


def fake_transcript(gap: float = 1.2) -> dict:
    t, segments = 0.5, []
    for s in SENTENCES:
        words = []
        for w in s.split():
            dur = 0.28 + 0.02 * len(w)
            words.append({"start": round(t, 3), "end": round(t + dur, 3), "word": w})
            t += dur + 0.06
        segments.append({"start": words[0]["start"], "end": words[-1]["end"], "text": s, "words": words})
        t += gap
    return {"language": "en", "segments": segments}


@pytest.fixture(scope="session")
def sample_video() -> Path:
    path = _TMP / "sample.mp4"
    if not path.exists():
        dur = fake_transcript()["segments"][-1]["end"] + 1.5
        # Landscape test pattern + tone that is gated on/off to create real silences.
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=size=1280x720:rate=30:d={dur}",
                        "-f", "lavfi", "-i", f"sine=frequency=330:duration={dur}",
                        "-af", "volume='if(lt(mod(t,6),4.6),0.6,0)':eval=frame",
                        "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", str(path)],
                       check=True)
    return path
