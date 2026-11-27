"""Niche-aware editing strategies.

Each niche tells the highlight engine what to look for and sets the default
edit settings for clips generated in that niche. Users can override all of it
per clip in the editor.
"""
from copy import deepcopy

BASE_EDIT = {
    "layout": "face",  # face | fill | split | blur | custom
    "custom_crop_x": 0.5,  # 0..1 horizontal center for custom layout
    "face_zoom": 1.0,  # >1 tighter crop for face-focused layout
    "resolution": "1080x1920",  # or 720x1280
    "fps": 30,
    "video_bitrate": "8M",
    "audio_bitrate": "192k",
    "captions": {
        "enabled": True,
        "style": "bold_pop",  # bold_pop | boxed | minimal | karaoke | neon
        "font": "Inter",
        "font_size": 74,
        "primary_color": "#FFFFFF",
        "highlight_color": "#FFD60A",
        "position": "lower",  # top | middle | lower
        "uppercase": True,
        "words_per_group": 3,
        "emphasize_keywords": True,
    },
    "remove_silence": True,
    "silence_threshold_db": -35,
    "min_silence": 0.6,
    "zoom_on_emphasis": True,
    "zoom_strength": 0.08,
    "text_overlays": [],
    "image_overlays": [],  # [{key, start, end, x, y, width}] uploaded via /api/assets  # [{text, start, end, position}]  times relative to clip start
    "hook_overlay": True,  # show chosen hook as a title card for the first seconds
    "hook_overlay_seconds": 2.5,
    "music": None,  # {file, volume} - file must be in the licensed music library
    "voice_volume": 1.0,
    "voiceover": None,  # {file, start, volume} uploaded voiceover asset
    "trim_start_offset": 0.0,
    "trim_end_offset": 0.0,
}

NICHES: dict[str, dict] = {
    "podcast": {
        "label": "Podcast & interviews",
        "focus": "Insightful, surprising or controversial statements and natural back-and-forth. Preserve dialogue; "
                 "never cut a speaker off mid-thought. Prefer moments where a question is posed and answered.",
        "edit": {"layout": "face", "captions": {"style": "bold_pop"}},
    },
    "education": {
        "label": "Education & tutorials",
        "focus": "Clear, self-contained explanations of one concept. Definitions, step-by-step reasoning, "
                 "'here is why' moments. Clarity beats drama.",
        "edit": {"captions": {"style": "boxed", "uppercase": False}, "zoom_strength": 0.05},
    },
    "business": {
        "label": "Business & entrepreneurship",
        "focus": "Practical, actionable advice, concrete numbers, frameworks, lessons from failures and wins.",
        "edit": {"captions": {"style": "bold_pop", "highlight_color": "#34D399"}},
    },
    "technology": {
        "label": "Technology & AI",
        "focus": "Product explanations, demos, predictions, surprising capabilities, clear comparisons.",
        "edit": {"captions": {"style": "neon", "highlight_color": "#60A5FA"}, "layout": "blur"},
    },
    "motivation": {
        "label": "Motivation & self-improvement",
        "focus": "Emotional, inspirational, story-driven moments with a strong closing line.",
        "edit": {"captions": {"style": "minimal", "uppercase": False}, "remove_silence": False,
                 "zoom_strength": 0.04},
    },
    "gaming": {
        "label": "Gaming",
        "focus": "Exciting gameplay, big plays, funny or intense reactions, clutch moments.",
        "edit": {"layout": "blur", "remove_silence": False, "captions": {"style": "bold_pop",
                                                                         "highlight_color": "#F472B6"}},
    },
    "news": {
        "label": "News & commentary",
        "focus": "Clear statements of what happened and why it matters. Avoid clips that misrepresent a "
                 "position by removing context.",
        "edit": {"captions": {"style": "boxed", "uppercase": False}},
    },
    "history": {
        "label": "History & documentaries",
        "focus": "Storytelling, surprising facts, vivid narration with a clear setup and payoff.",
        "edit": {"layout": "blur", "captions": {"style": "minimal", "uppercase": False}},
    },
    "finance": {
        "label": "Finance",
        "focus": "Concrete financial insights and numbers. Never present opinions as guaranteed returns.",
        "edit": {"captions": {"style": "bold_pop", "highlight_color": "#34D399"}},
    },
    "entertainment": {"label": "Entertainment", "focus": "Funny, surprising, emotional or quotable moments.",
                      "edit": {}},
    "sports": {"label": "Sports", "focus": "Big plays, analysis with a clear takeaway, emotional reactions.",
               "edit": {"layout": "blur", "remove_silence": False}},
    "science": {"label": "Science", "focus": "Mind-blowing facts with a clear explanation of why.",
                "edit": {"captions": {"style": "boxed", "uppercase": False}}},
    "lifestyle": {"label": "Lifestyle", "focus": "Relatable tips, personal stories, practical routines.",
                  "edit": {"captions": {"style": "minimal", "uppercase": False}}},
    "travel": {"label": "Travel", "focus": "Vivid places, practical tips, surprising local facts.",
               "edit": {"layout": "blur"}},
    "general": {"label": "General knowledge", "focus": "Interesting, self-contained ideas and facts.", "edit": {}},
}


def _merge(base: dict, override: dict) -> dict:
    out = deepcopy(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = deepcopy(v)
    return out


def default_edit_settings(niche: str, brand: dict | None = None) -> dict:
    settings = _merge(BASE_EDIT, NICHES.get(niche, NICHES["general"])["edit"])
    if brand:
        cap = {k: brand[k] for k in ("font", "primary_color", "highlight_color") if brand.get(k)}
        if cap:
            settings = _merge(settings, {"captions": cap})
    return settings


def merge_edit_settings(current: dict, patch: dict) -> dict:
    return _merge(current, patch)


def niche_focus(niche: str) -> str:
    return NICHES.get(niche, NICHES["general"])["focus"]
