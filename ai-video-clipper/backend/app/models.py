import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def _id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    title: Mapped[str] = mapped_column(String(300))
    niche: Mapped[str] = mapped_column(String(40), default="podcast")
    language: Mapped[str] = mapped_column(String(10), default="auto")
    target_platforms: Mapped[list] = mapped_column(JSON, default=list)
    desired_clips: Mapped[int] = mapped_column(Integer, default=5)
    min_duration: Mapped[int] = mapped_column(Integer, default=15)
    max_duration: Mapped[int] = mapped_column(Integer, default=60)

    # Rights declaration (required before processing)
    rights_basis: Mapped[str] = mapped_column(String(40))
    rights_confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    rights_notes: Mapped[str] = mapped_column(Text, default="")

    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source_key: Mapped[str | None] = mapped_column(String(500), nullable=True)  # storage key of uploaded video
    source_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # awaiting_upload | queued | processing | ready | failed
    status: Mapped[str] = mapped_column(String(30), default="queued")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    stage: Mapped[str] = mapped_column(String(80), default="")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)  # ffprobe info
    transcript: Mapped[dict] = mapped_column(JSON, default=dict)  # {language, segments:[{start,end,text,words:[...]}]}
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)  # summary, topics, scenes, speakers, provider used

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    clips: Mapped[list["Clip"]] = relationship(back_populates="project", cascade="all, delete-orphan",
                                               order_by="Clip.score.desc()")


class Clip(Base):
    __tablename__ = "clips"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)

    title: Mapped[str] = mapped_column(String(300))
    start: Mapped[float] = mapped_column(Float)
    end: Mapped[float] = mapped_column(Float)
    transcript_text: Mapped[str] = mapped_column(Text, default="")
    hook: Mapped[str] = mapped_column(Text, default="")
    alt_hooks: Mapped[list] = mapped_column(JSON, default=list)  # [{style, text}]
    score: Mapped[int] = mapped_column(Integer, default=0)  # estimated engagement 0-100 (not a prediction)
    score_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    reason: Mapped[str] = mapped_column(Text, default="")
    target_audience: Mapped[str] = mapped_column(Text, default="")
    recommended_platform: Mapped[str] = mapped_column(String(40), default="")
    caption: Mapped[str] = mapped_column(Text, default="")
    hashtags: Mapped[list] = mapped_column(JSON, default=list)
    emphasis_words: Mapped[list] = mapped_column(JSON, default=list)
    value_adds: Mapped[list] = mapped_column(JSON, default=list)  # suggested genuine additions
    suggested_post_time: Mapped[str] = mapped_column(String(120), default="")

    edit_settings: Mapped[dict] = mapped_column(JSON, default=dict)
    approved: Mapped[bool] = mapped_column(Boolean, default=False)

    # draft | queued | rendering | rendered | failed
    render_status: Mapped[str] = mapped_column(String(30), default="draft")
    render_progress: Mapped[float] = mapped_column(Float, default=0.0)
    render_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rendered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped[Project] = relationship(back_populates="clips")


class Job(Base):
    """A unit of background work, shown in the processing-queue widget."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    kind: Mapped[str] = mapped_column(String(30))  # analyze | render
    project_id: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    clip_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | running | done | failed
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Setting(Base):
    """Key/value store for brand and AI settings (single-workspace MVP)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
