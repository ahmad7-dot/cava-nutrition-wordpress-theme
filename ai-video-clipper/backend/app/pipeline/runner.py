"""End-to-end jobs: analyse a project (transcribe -> understand -> select clips) and render a clip."""
from __future__ import annotations

import logging
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Clip, Job, Project, Setting
from app.niches import default_edit_settings, niche_focus
from app.pipeline import media, reframe
from app.pipeline.render import render_clip
from app.pipeline.scoring import overall
from app.pipeline.segments import build_sentences, window_for_range, words_in_range
from app.providers.llm import AnalysisResult, ClipPlan, SelectionRequest, get_llm
from app.providers.transcription import get_transcriber
from app.storage import get_storage

log = logging.getLogger(__name__)

POST_TIMES = {
    "tiktok": "Weekdays 7-9pm in your audience's time zone",
    "instagram_reels": "Weekdays 11am-1pm or 7-9pm in your audience's time zone",
    "youtube_shorts": "Weekdays 12-3pm or weekends 9-11am in your audience's time zone",
}


def _set(db, obj, **kw):
    for k, v in kw.items():
        setattr(obj, k, v)
    db.commit()


def _finish_job(db, job_id: str | None, status: str, error: str | None = None):
    if not job_id:
        return
    job = db.get(Job, job_id)
    if job:
        _set(db, job, status=status, error=error, progress=1.0 if status == "done" else job.progress,
             finished_at=datetime.now(timezone.utc))


def analyze_project(project_id: str, job_id: str | None = None) -> None:
    db = SessionLocal()
    project = db.get(Project, project_id)
    job = db.get(Job, job_id) if job_id else None
    if not project:
        return

    def stage(name: str, p: float):
        _set(db, project, stage=name, progress=round(p, 3), status="processing")
        if job:
            _set(db, job, progress=round(p, 3), status="running")

    try:
        if not project.rights_basis:
            raise ValueError("A rights declaration is required before processing.")
        storage = get_storage()
        src = storage.local_path(project.source_key)
        work = get_settings().work_dir / project.id
        work.mkdir(parents=True, exist_ok=True)

        stage("Reading video metadata", 0.02)
        meta = media.probe(src)
        _set(db, project, metadata_json=meta)

        transcript = project.transcript if project.transcript.get("segments") else None
        if transcript is None:
            if not meta["has_audio"]:
                raise ValueError("This video has no audio track, so there is nothing to transcribe.")
            stage("Extracting audio", 0.05)
            audio = media.extract_audio(src, work / "audio.wav")
            stage("Transcribing speech", 0.08)
            transcript = get_transcriber().transcribe(
                audio, project.language, lambda p: stage("Transcribing speech", 0.08 + 0.52 * p))
            _set(db, project, transcript=transcript)
            audio.unlink(missing_ok=True)

        stage("Detecting scenes", 0.62)
        scenes = media.detect_scenes(src)

        stage("Analysing faces and speakers", 0.68)
        track = reframe.analyze_faces(src, sample_fps=0.5)
        visual = {"face_presence": round(track.face_ratio, 2), "typical_people_on_screen": track.max_faces,
                  "two_person_layout": reframe.two_speaker_centers(track) is not None}

        stage("Understanding the full video", 0.75)
        sentences = build_sentences(transcript)
        if len(sentences) < 2:
            raise ValueError("Not enough speech was found to create meaningful clips.")
        llm = get_llm()
        req = SelectionRequest(title=project.title, niche=project.niche, niche_focus=niche_focus(project.niche),
                               language=transcript.get("language", project.language),
                               platforms=project.target_platforms or [], desired_clips=project.desired_clips,
                               min_duration=project.min_duration, max_duration=project.max_duration,
                               scenes=scenes)
        result: AnalysisResult = llm.select_clips(req, sentences)

        stage("Building clips", 0.92)
        brand = (db.get(Setting, "brand").value if db.get(Setting, "brand") else {}) or {}
        for c in list(project.clips):
            if c.render_status != "rendered":
                db.delete(c)
        db.commit()
        made = []
        for plan in result.clips:
            clip = _clip_from_plan(plan, sentences, transcript, req, project, brand, made)
            if clip:
                db.add(clip)
                made.append(clip)
        db.commit()
        _set(db, project, analysis={
            "summary": result.summary, "topics": result.topics, "scenes": scenes, "scene_count": len(scenes),
            "sentence_count": len(sentences), "visual": visual, "provider": llm.name,
            "language": transcript.get("language"), "clips_found": len(made),
            "note": "Engagement scores are estimates, not predictions of virality."},
            status="ready", stage="Done", progress=1.0, error=None)
        _finish_job(db, job_id, "done")
    except Exception as exc:  # report any failure to the user
        log.error("analysis failed: %s", traceback.format_exc())
        _set(db, project, status="failed", error=str(exc), stage="Failed")
        _finish_job(db, job_id, "failed", str(exc))
    finally:
        db.close()


def _clip_from_plan(plan: ClipPlan, sentences, transcript, req: SelectionRequest, project: Project, brand: dict,
                    existing: list[Clip]) -> Clip | None:
    first, last = sorted((plan.first_sentence, plan.last_sentence))
    w = window_for_range(sentences, first, last)
    # Nudge the range by whole sentences to respect the duration limits.
    while w.duration > req.max_duration * 1.1 and w.last > w.first:
        w = window_for_range(sentences, w.first, w.last - 1)
    while w.duration < req.min_duration * 0.85 and w.last + 1 < len(sentences):
        w = window_for_range(sentences, w.first, w.last + 1)
    if w.duration < 3 or any(not (w.end <= c.start or w.start >= c.end) for c in existing):
        return None
    breakdown = {k: max(0, min(100, int(v))) for k, v in plan.scores.model_dump().items()}
    platform = plan.recommended_platform
    return Clip(
        project_id=project.id, title=plan.title[:300], start=round(max(w.start - 0.1, 0), 3),
        end=round(w.end + 0.25, 3), transcript_text=w.text, hook=plan.hook,
        alt_hooks=[h.model_dump() for h in plan.alt_hooks][:3], score=overall(breakdown),
        score_breakdown=breakdown, reason=plan.reason, target_audience=plan.target_audience,
        recommended_platform=platform, caption=plan.caption,
        hashtags=[h.lstrip("#").replace(" ", "") for h in plan.hashtags][:8],
        emphasis_words=plan.emphasis_words[:8], value_adds=plan.value_adds,
        suggested_post_time=POST_TIMES.get(platform, ""),
        edit_settings=default_edit_settings(project.niche, brand),
    )


def render(clip_id: str, job_id: str | None = None) -> None:
    db = SessionLocal()
    clip = db.get(Clip, clip_id)
    job = db.get(Job, job_id) if job_id else None
    if not clip:
        return
    try:
        project = clip.project
        storage = get_storage()
        src = storage.local_path(project.source_key)
        settings = get_settings()
        edit = clip.edit_settings or default_edit_settings(project.niche)
        words = edit.get("word_overrides") or words_in_range(
            project.transcript, clip.start + edit.get("trim_start_offset", 0) - 0.5,
            clip.end + edit.get("trim_end_offset", 0) + 0.5)
        music = None
        if edit.get("music") and edit["music"].get("file"):
            candidate = (settings.music_library_dir / Path(edit["music"]["file"]).name)
            music = candidate if candidate.exists() else None
        voiceover = None
        if edit.get("voiceover") and edit["voiceover"].get("key"):
            voiceover = storage.local_path(edit["voiceover"]["key"])

        last = [0.0]

        def progress(p: float):
            if p - last[0] >= 0.05 or p >= 1.0:
                last[0] = p
                _set(db, clip, render_progress=round(p, 3), render_status="rendering")
                if job:
                    _set(db, job, progress=round(p, 3), status="running")

        _set(db, clip, render_status="rendering", render_error=None, render_progress=0.0)
        out = settings.outputs_dir / f"{clip.id}.mp4"
        info = render_clip(src, clip.start, clip.end, words, edit, out, settings.work_dir / f"r_{clip.id}",
                           hook=clip.hook, emphasis=clip.emphasis_words, music_path=music,
                           voiceover_path=voiceover, progress=progress)
        key = f"outputs/{project.id}/{clip.id}.mp4"
        storage.put_file(key, out)
        if storage.local_path(key).resolve() != out.resolve():
            out.unlink(missing_ok=True)
        edit_meta = dict(edit)
        edit_meta["_last_render"] = {k: v for k, v in info.items() if k != "words"}
        _set(db, clip, output_key=key, render_status="rendered", render_progress=1.0,
             rendered_at=datetime.now(timezone.utc), edit_settings=edit_meta)
        _finish_job(db, job_id, "done")
    except Exception as exc:
        log.error("render failed: %s", traceback.format_exc())
        _set(db, clip, render_status="failed", render_error=str(exc))
        _finish_job(db, job_id, "failed", str(exc))
    finally:
        db.close()


def stale_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=6)
