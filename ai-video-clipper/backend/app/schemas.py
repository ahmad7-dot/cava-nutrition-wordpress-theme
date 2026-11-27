from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

RIGHTS_BASES = {
    "owner": "I created this video / I own the copyright",
    "licensed": "I have a licence that covers editing and redistribution",
    "permission": "I have written permission from the rights holder",
    "public_domain": "The video is in the public domain or under a licence that allows reuse (e.g. CC BY)",
}
PLATFORMS = {
    "tiktok": {"label": "TikTok", "max_seconds": 600},
    "instagram_reels": {"label": "Instagram Reels", "max_seconds": 180},
    "youtube_shorts": {"label": "YouTube Shorts", "max_seconds": 180},
}


class ClipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    title: str
    start: float
    end: float
    transcript_text: str
    hook: str
    alt_hooks: list[dict]
    score: int
    score_breakdown: dict
    reason: str
    target_audience: str
    recommended_platform: str
    caption: str
    hashtags: list[str]
    emphasis_words: list[str]
    value_adds: list[str]
    suggested_post_time: str
    edit_settings: dict
    approved: bool
    render_status: str
    render_progress: float
    render_error: str | None
    output_key: str | None
    rendered_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    niche: str
    status: str
    progress: float
    stage: str
    error: str | None
    source_url: str | None
    source_filename: str | None
    desired_clips: int
    min_duration: int
    max_duration: int
    target_platforms: list[str]
    language: str
    rights_basis: str
    metadata_json: dict
    created_at: datetime
    updated_at: datetime
    clip_count: int = 0


class ProjectOut(ProjectSummary):
    analysis: dict
    clips: list[ClipOut] = []


class ClipPatch(BaseModel):
    title: str | None = None
    start: float | None = Field(None, ge=0)
    end: float | None = Field(None, ge=0)
    hook: str | None = None
    caption: str | None = None
    hashtags: list[str] | None = None
    emphasis_words: list[str] | None = None
    approved: bool | None = None
    edit_settings: dict[str, Any] | None = None  # merged into existing settings
    replace_edit_settings: bool = False  # true: replace instead of merge (used by undo/redo)


class SettingIn(BaseModel):
    value: dict[str, Any]
