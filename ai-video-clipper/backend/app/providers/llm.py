"""LLM providers for content understanding: clip selection, scoring, hooks and social copy.

`AnthropicProvider` sends the *whole* timestamped transcript to Claude so clip
choices are made with full-video context. `HeuristicProvider` needs no API and
is used when no key is configured.
"""
from __future__ import annotations

import json
import logging
from typing import Literal, Protocol

from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.pipeline.scoring import CRITERIA, heuristic_breakdown, overall
from app.pipeline.segments import Sentence, Window, candidate_windows

log = logging.getLogger(__name__)

HookStyle = Literal["curiosity", "question", "educational", "storytelling", "problem_solving"]
Platform = Literal["tiktok", "instagram_reels", "youtube_shorts"]


class Hook(BaseModel):
    style: HookStyle
    text: str


class Scores(BaseModel):
    opening: int
    curiosity: int
    emotion: int
    information: int
    storytelling: int
    relevance: int
    clarity: int
    retention: int
    ending: int
    completeness: int


class ClipPlan(BaseModel):
    first_sentence: int = Field(description="Index of the first sentence of the clip (inclusive)")
    last_sentence: int = Field(description="Index of the last sentence of the clip (inclusive)")
    title: str
    hook: str = Field(description="Primary on-screen hook. Must be faithful to what is said.")
    alt_hooks: list[Hook] = Field(description="Exactly three alternative hooks, different styles")
    scores: Scores
    reason: str = Field(description="Why this moment was selected")
    target_audience: str
    recommended_platform: Platform
    caption: str = Field(description="Social media description/caption")
    hashtags: list[str]
    emphasis_words: list[str] = Field(description="Up to 8 words from the transcript to emphasise in captions")
    value_adds: list[str] = Field(description="Genuinely useful additions (context, B-roll ideas, graphics)")


class AnalysisResult(BaseModel):
    summary: str
    topics: list[str]
    clips: list[ClipPlan]


class HooksResult(BaseModel):
    hooks: list[Hook]


class SelectionRequest(BaseModel):
    title: str
    niche: str
    niche_focus: str
    language: str
    platforms: list[str]
    desired_clips: int
    min_duration: float
    max_duration: float
    scenes: list[float] = []


class LLMProvider(Protocol):
    name: str

    def select_clips(self, req: SelectionRequest, sentences: list[Sentence]) -> AnalysisResult: ...

    def generate_hooks(self, transcript: str, niche: str) -> list[Hook]: ...


# ----------------------------------------------------------------------------------------------
SYSTEM_PROMPT = """You are an expert short-form video editor and producer. You turn long-form videos into
short clips for TikTok, Instagram Reels and YouTube Shorts.

You will receive the full transcript of one video as numbered sentences with timestamps. Read and understand
the whole video first, then choose the moments that work best as standalone short clips.

What makes a good clip:
- It opens strongly: the first sentence grabs attention without needing earlier context.
- It delivers one complete idea, story or answer, and ends on a satisfying line, not mid-thought.
- It is clear to someone who has not seen the rest of the video. Avoid clips that start with an unresolved
  reference ("so that's why he...") or that only make sense with the surrounding conversation.
- It carries curiosity, emotion, useful information or a story.

Rules:
- Clips are ranges of whole sentences (first_sentence..last_sentence). Their duration must fall within the
  requested range. Clips must not overlap.
- Return only as many clips as the material genuinely supports, up to the requested number. Never pad
  the list with weak clips.
- Score each criterion 0-100 honestly. These are estimates of engagement, not predictions; a typical decent
  clip lands at 55-75. Reserve 85+ for truly exceptional moments.
- Hooks and captions must be faithful to what the speaker actually says. Never invent claims, exaggerate,
  or misrepresent a person's position. No clickbait that the clip does not deliver on.
- Give exactly three alternative hooks, each in a different style.
- Hashtags: 3-8 relevant tags without the leading '#'.
- value_adds: only additions that would genuinely make the clip clearer or more useful (for example a one-line
  context card, a definition, a relevant chart idea, B-roll of the thing being described). Empty if none.
- Write titles, hooks and captions in the same language as the transcript."""


def _format_transcript(sentences: list[Sentence]) -> str:
    return "\n".join(f"[{s.idx}] {s.start:.1f}-{s.end:.1f}s: {s.text}" for s in sentences)


class AnthropicProvider:
    name = "anthropic"

    def __init__(self):
        import anthropic

        s = get_settings()
        self.client = anthropic.Anthropic()
        self.model = s.llm_model
        self.effort = s.llm_effort

    def _structured(self, system: str, user: str, schema_model: type[BaseModel], max_tokens: int = 32000):
        schema = _strict_schema(schema_model.model_json_schema())
        with self.client.beta.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
            thinking={"type": "adaptive"},
            output_config={"effort": self.effort, "format": {"type": "json_schema", "schema": schema}},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        ) as stream:
            message = stream.get_final_message()
        if message.stop_reason == "refusal":
            raise RuntimeError("The model declined to analyse this content.")
        if message.stop_reason == "max_tokens":
            raise RuntimeError("The model response was cut off (max_tokens).")
        text = next(b.text for b in message.content if b.type == "text")
        return schema_model.model_validate(json.loads(text))

    def select_clips(self, req: SelectionRequest, sentences: list[Sentence]) -> AnalysisResult:
        user = (
            f"Video title: {req.title}\nNiche: {req.niche}\nNiche guidance: {req.niche_focus}\n"
            f"Target platforms: {', '.join(req.platforms) or 'all'}\n"
            f"Requested clips: up to {req.desired_clips}\n"
            f"Clip duration: {req.min_duration:.0f}-{req.max_duration:.0f} seconds\n"
            f"Scene cuts (seconds): {', '.join(f'{t:.1f}' for t in req.scenes[:300]) or 'unknown'}\n\n"
            f"<transcript>\n{_format_transcript(sentences)}\n</transcript>"
        )
        return self._structured(SYSTEM_PROMPT, user, AnalysisResult, max_tokens=64000)

    def generate_hooks(self, transcript: str, niche: str) -> list[Hook]:
        system = ("You write hooks for short-form video clips. A hook is the opening line or on-screen title "
                  "that makes viewers keep watching. Hooks must be faithful to what is said in the clip: never "
                  "misleading, never promising something the clip does not deliver. Keep each under 12 words.")
        user = (f"Niche: {niche}\nWrite three hooks in three different styles (choose from curiosity, question, "
                f"educational, storytelling, problem_solving) for this clip:\n\n<clip>\n{transcript}\n</clip>")
        return self._structured(system, user, HooksResult, max_tokens=8000).hooks


def _strict_schema(schema: dict) -> dict:
    """Inline $defs and set additionalProperties=false / required on every object for strict JSON output."""
    defs = schema.pop("$defs", {})

    def walk(node):
        if isinstance(node, dict):
            if "$ref" in node:
                return walk(dict(defs[node["$ref"].split("/")[-1]]))
            out = {}
            for k, v in node.items():
                if k in ("title", "default"):  # schema annotations, not field names
                    continue
                out[k] = {pk: walk(pv) for pk, pv in v.items()} if k == "properties" else walk(v)
            node = out
            if node.get("type") == "object":
                node["additionalProperties"] = False
                node["required"] = list(node.get("properties", {}).keys())
            return node
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(schema)


# ----------------------------------------------------------------------------------------------
class HeuristicProvider:
    """Rule-based fallback. Lower quality than an LLM, but free and offline."""

    name = "heuristic"

    def select_clips(self, req: SelectionRequest, sentences: list[Sentence]) -> AnalysisResult:
        targets = sorted({max(req.min_duration, min(req.max_duration, t))
                          for t in (15, 30, 45, 60, 90) if req.min_duration <= t <= req.max_duration}
                         or {(req.min_duration + req.max_duration) / 2})
        scored: list[tuple[int, Window, dict]] = []
        for t in targets:
            for w in candidate_windows(sentences, t):
                if not (req.min_duration * 0.85 <= w.duration <= req.max_duration * 1.1):
                    continue
                b = heuristic_breakdown(w.text, w.duration)
                scored.append((overall(b), w, b))
        scored.sort(key=lambda x: x[0], reverse=True)
        chosen: list[tuple[int, Window, dict]] = []
        for item in scored:
            w = item[1]
            if all(w.end <= c[1].start or w.start >= c[1].end for c in chosen):
                chosen.append(item)
            if len(chosen) >= req.desired_clips:
                break
        clips = []
        for score, w, b in chosen:
            first_line = sentences[w.first].text
            title = _shorten(first_line, 70)
            clips.append(ClipPlan(
                first_sentence=w.first, last_sentence=w.last, title=title, hook=_shorten(first_line, 60),
                alt_hooks=[Hook(style="curiosity", text=f"Wait for the end: {_shorten(first_line, 40)}"),
                           Hook(style="question", text=f"{_shorten(first_line.rstrip('.!?'), 50)}?"),
                           Hook(style="educational", text=f"One lesson from {req.title[:40]}")],
                scores=Scores(**{k: int(v) for k, v in b.items()}),
                reason=f"Rule-based pick: scored highest on {' and '.join(_top_criteria(b))}.",
                target_audience=f"Viewers interested in {req.niche}",
                recommended_platform="tiktok" if w.duration <= 45 else "youtube_shorts",
                caption=_shorten(w.text, 200), hashtags=[req.niche, "shorts", "fyp"],
                emphasis_words=[], value_adds=[]))
        topics = sorted({req.niche})
        return AnalysisResult(summary=_shorten(" ".join(s.text for s in sentences[:8]), 400), topics=topics,
                              clips=clips)

    def generate_hooks(self, transcript: str, niche: str) -> list[Hook]:
        first = _shorten(transcript.split(".")[0], 50)
        return [Hook(style="curiosity", text=f"Nobody talks about this: {first}"),
                Hook(style="question", text=f"{first.rstrip('?')}?"),
                Hook(style="educational", text=f"The {niche} lesson in 30 seconds")]


def _top_criteria(b: dict) -> list[str]:
    return [CRITERIA[k][0].lower() for k, _ in sorted(b.items(), key=lambda kv: kv[1], reverse=True)[:2]]


def _shorten(text: str, n: int) -> str:
    text = text.strip()
    return text if len(text) <= n else text[: n - 1].rsplit(" ", 1)[0] + "…"


def get_llm() -> LLMProvider:
    import os

    s = get_settings()
    if s.llm_provider == "anthropic" and (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return AnthropicProvider()
    if s.llm_provider == "anthropic":
        log.warning("No Anthropic credentials found; falling back to heuristic clip selection.")
    return HeuristicProvider()
