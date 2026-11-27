import mimetypes
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.models import Clip, Job, Project, Setting
from app.niches import BASE_EDIT, NICHES, merge_edit_settings
from app.pipeline.captions import CAPTION_STYLES, to_srt
from app.pipeline.media import ALLOWED_EXTENSIONS
from app.pipeline.render import map_words, KeepSegment
from app.pipeline.segments import effective_words, words_in_range
from app.providers.llm import get_llm
from app.schemas import PLATFORMS, RIGHTS_BASES, ClipOut, ClipPatch, ProjectOut, ProjectSummary, SettingIn
from app.storage import get_storage
from app.worker import enqueue_analysis, enqueue_render

router = APIRouter(prefix="/api")
YOUTUBE = re.compile(r"^https?://(www\.|m\.)?(youtube\.com|youtu\.be)/", re.I)
ASSET_EXT = {".png", ".jpg", ".jpeg", ".webp", ".mp3", ".wav", ".m4a", ".aac"}


def _summary(p: Project) -> dict:
    d = ProjectSummary.model_validate(p).model_dump()
    d["clip_count"] = len(p.clips)
    return d


def _get_project(db: Session, pid: str) -> Project:
    p = db.get(Project, pid)
    if not p:
        raise HTTPException(404, "Project not found")
    return p


def _get_clip(db: Session, cid: str) -> Clip:
    c = db.get(Clip, cid)
    if not c:
        raise HTTPException(404, "Clip not found")
    return c


def _save_upload(file: UploadFile, prefix: str, allowed: set[str]) -> tuple[str, str]:
    name = Path(file.filename or "upload").name
    ext = Path(name).suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type {ext or '(none)'}. Allowed: {', '.join(sorted(allowed))}")
    key = f"{prefix}/{uuid.uuid4().hex}{ext}"
    size = get_storage().save_stream(key, file.file)
    if size > get_settings().max_upload_mb * 1024 * 1024:
        get_storage().delete(key)
        raise HTTPException(413, "File is too large")
    return key, name


# ---------------------------------------------------------------------------------------------- meta
@router.get("/health")
def health():
    return {"ok": True}


@router.get("/options")
def options():
    return {
        "niches": {k: v["label"] for k, v in NICHES.items()},
        "platforms": PLATFORMS,
        "rights_bases": RIGHTS_BASES,
        "caption_styles": {k: v["label"] for k, v in CAPTION_STYLES.items()},
        "layouts": {"face": "Face-focused crop", "fill": "Full-screen speaker", "split": "Split screen (2 people)",
                    "blur": "Original with blurred background", "custom": "Custom crop"},
        "resolutions": ["1080x1920", "720x1280"],
        "durations": [10, 15, 30, 45, 60, 90],
        "default_edit": BASE_EDIT,
        "llm_provider": get_llm().name,
    }


# ---------------------------------------------------------------------------------------------- projects
@router.post("/projects", response_model=ProjectOut)
def create_project(
    title: str = Form(...),
    niche: str = Form("podcast"),
    language: str = Form("auto"),
    target_platforms: str = Form("tiktok,instagram_reels,youtube_shorts"),
    desired_clips: int = Form(5),
    min_duration: int = Form(15),
    max_duration: int = Form(60),
    rights_basis: str = Form(...),
    rights_confirmed: bool = Form(...),
    rights_notes: str = Form(""),
    source_url: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if not rights_confirmed or rights_basis not in RIGHTS_BASES:
        raise HTTPException(400, "Confirm that you own or are authorised to use this video before uploading.")
    if niche not in NICHES:
        raise HTTPException(400, "Unknown niche")
    if not 1 <= desired_clips <= 30:
        raise HTTPException(400, "desired_clips must be 1-30")
    if not (5 <= min_duration <= max_duration <= 180):
        raise HTTPException(400, "Durations must satisfy 5 <= min <= max <= 180 seconds")
    if source_url and not re.match(r"^https?://", source_url):
        raise HTTPException(400, "source_url must be an http(s) URL")
    if not file and not source_url:
        raise HTTPException(400, "Upload a video file or provide a source URL")

    p = Project(title=title.strip()[:300], niche=niche, language=language,
                target_platforms=[t for t in target_platforms.split(",") if t in PLATFORMS],
                desired_clips=desired_clips, min_duration=min_duration, max_duration=max_duration,
                rights_basis=rights_basis, rights_notes=rights_notes[:2000], source_url=source_url)
    if file:
        p.source_key, p.source_filename = _save_upload(file, "uploads", ALLOWED_EXTENSIONS)
        p.status = "queued"
    else:
        # We do not download from YouTube or other platforms: their terms prohibit it, and we can't verify
        # rights for a URL. The user uploads the original file they are authorised to use.
        p.status = "awaiting_upload"
        p.stage = "Upload the original video file to continue"
    db.add(p)
    db.commit()
    if p.source_key:
        enqueue_analysis(p.id)
    db.refresh(p)
    return ProjectOut.model_validate(p)


@router.post("/projects/{pid}/upload", response_model=ProjectOut)
def upload_source(pid: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    p = _get_project(db, pid)
    if p.status in ("queued", "processing"):
        raise HTTPException(409, "Project is already processing")
    p.source_key, p.source_filename = _save_upload(file, "uploads", ALLOWED_EXTENSIONS)
    p.status, p.stage, p.error, p.transcript = "queued", "Queued", None, {}
    db.commit()
    enqueue_analysis(p.id)
    return ProjectOut.model_validate(p)


@router.post("/projects/{pid}/reanalyze", response_model=ProjectOut)
def reanalyze(pid: str, db: Session = Depends(get_db)):
    p = _get_project(db, pid)
    if not p.source_key:
        raise HTTPException(400, "Upload a video first")
    if p.status in ("queued", "processing"):
        raise HTTPException(409, "Project is already processing")
    p.status, p.stage, p.error, p.progress = "queued", "Queued", None, 0.0
    db.commit()
    enqueue_analysis(p.id)
    return ProjectOut.model_validate(p)


@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    return [_summary(p) for p in db.scalars(select(Project).order_by(Project.created_at.desc()))]


@router.get("/projects/{pid}", response_model=ProjectOut)
def get_project(pid: str, db: Session = Depends(get_db)):
    p = _get_project(db, pid)
    out = ProjectOut.model_validate(p)
    out.clip_count = len(p.clips)
    return out


@router.delete("/projects/{pid}")
def delete_project(pid: str, db: Session = Depends(get_db)):
    p = _get_project(db, pid)
    storage = get_storage()
    for key in [p.source_key] + [c.output_key for c in p.clips]:
        if key:
            storage.delete(key)
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/projects/{pid}/source")
def project_source(pid: str, db: Session = Depends(get_db)):
    p = _get_project(db, pid)
    if not p.source_key:
        raise HTTPException(404, "No source video")
    path = get_storage().local_path(p.source_key)
    return FileResponse(path, media_type=mimetypes.guess_type(path.name)[0] or "video/mp4")


@router.get("/projects/{pid}/transcript")
def project_transcript(pid: str, db: Session = Depends(get_db)):
    return _get_project(db, pid).transcript


# ---------------------------------------------------------------------------------------------- clips
@router.get("/clips")
def list_clips(rendered: bool = False, db: Session = Depends(get_db)):
    q = select(Clip).order_by(Clip.updated_at.desc())
    if rendered:
        q = q.where(Clip.render_status == "rendered")
    out = []
    for c in db.scalars(q):
        d = ClipOut.model_validate(c).model_dump()
        d["project_title"] = c.project.title
        out.append(d)
    return out


@router.get("/clips/{cid}", response_model=ClipOut)
def get_clip(cid: str, db: Session = Depends(get_db)):
    return _get_clip(db, cid)


@router.get("/clips/{cid}/words")
def clip_words(cid: str, pad: float = Query(20.0, ge=0, le=120), db: Session = Depends(get_db)):
    """Words around the clip in absolute source time, with caption edits applied (for the editor timeline)."""
    c = _get_clip(db, cid)
    overrides = (c.edit_settings or {}).get("word_overrides") or []
    return {"words": effective_words(c.project.transcript, max(c.start - pad, 0), c.end + pad, overrides),
            "edited": bool(overrides)}


@router.patch("/clips/{cid}", response_model=ClipOut)
def patch_clip(cid: str, patch: ClipPatch, db: Session = Depends(get_db)):
    c = _get_clip(db, cid)
    data = patch.model_dump(exclude_unset=True)
    edit = data.pop("edit_settings", None)
    replace = data.pop("replace_edit_settings", False)
    for k, v in data.items():
        setattr(c, k, v)
    if c.end - c.start < 1:
        raise HTTPException(400, "Clip must be at least 1 second long")
    duration = (c.project.metadata_json or {}).get("duration")
    if duration and c.end > duration + 0.5:
        raise HTTPException(400, "End time is past the end of the video")
    if "start" in data or "end" in data:
        c.transcript_text = " ".join(w["word"] for w in words_in_range(c.project.transcript, c.start, c.end))
    if edit is not None:
        c.edit_settings = edit if replace else merge_edit_settings(c.edit_settings or {}, edit)
    if c.render_status == "rendered":
        c.render_status = "draft"  # edits make the previous render stale (file is kept until re-render)
    db.commit()
    return c


@router.post("/clips/{cid}/hooks", response_model=ClipOut)
def regenerate_hooks(cid: str, db: Session = Depends(get_db)):
    c = _get_clip(db, cid)
    try:
        hooks = get_llm().generate_hooks(c.transcript_text, c.project.niche)
    except Exception as exc:
        raise HTTPException(502, f"Hook generation failed: {exc}")
    c.alt_hooks = [h.model_dump() for h in hooks][:3]
    db.commit()
    return c


@router.post("/clips/{cid}/render", response_model=ClipOut)
def render_clip(cid: str, db: Session = Depends(get_db)):
    c = _get_clip(db, cid)
    if c.render_status in ("queued", "rendering"):
        raise HTTPException(409, "Already rendering")
    c.render_status, c.render_progress, c.render_error = "queued", 0.0, None
    db.commit()
    enqueue_render(c.id, c.project_id)
    return c


@router.get("/clips/{cid}/download")
def download(cid: str, db: Session = Depends(get_db)):
    c = _get_clip(db, cid)
    if not c.output_key:
        raise HTTPException(404, "Clip has not been rendered yet")
    safe = re.sub(r"[^\w\- ]", "", c.title)[:60].strip().replace(" ", "_") or c.id
    return FileResponse(get_storage().local_path(c.output_key), media_type="video/mp4", filename=f"{safe}.mp4")


@router.get("/clips/{cid}/preview")
def preview(cid: str, db: Session = Depends(get_db)):
    c = _get_clip(db, cid)
    if not c.output_key:
        raise HTTPException(404, "Clip has not been rendered yet")
    return FileResponse(get_storage().local_path(c.output_key), media_type="video/mp4")


@router.get("/clips/{cid}/srt", response_class=PlainTextResponse)
def srt(cid: str, db: Session = Depends(get_db)):
    c = _get_clip(db, cid)
    words = effective_words(c.project.transcript, c.start, c.end, (c.edit_settings or {}).get("word_overrides"))
    return to_srt(map_words(words, [KeepSegment(c.start, c.end, 0.0)]))


@router.get("/clips/{cid}/export")
def export_metadata(cid: str, platform: str = Query("tiktok"), db: Session = Depends(get_db)):
    c = _get_clip(db, cid)
    tags = " ".join(f"#{h}" for h in c.hashtags)
    limits = {"tiktok": 2200, "instagram_reels": 2200, "youtube_shorts": 5000}
    desc = f"{c.caption}\n\n{tags}".strip()[: limits.get(platform, 2200)]
    return {
        "platform": platform, "title": c.title[:100], "description": desc, "caption": c.caption,
        "hashtags": c.hashtags, "suggested_post_time": c.suggested_post_time,
        "video": {"container": "mp4", "video_codec": "h264", "audio_codec": "aac", "aspect": "9:16",
                  "resolution": (c.edit_settings or {}).get("resolution", "1080x1920"),
                  "fps": (c.edit_settings or {}).get("fps", 30),
                  "bitrate": (c.edit_settings or {}).get("video_bitrate", "8M")},
        "download_url": f"/api/clips/{c.id}/download" if c.output_key else None,
        "note": "Review before posting. Nothing is published automatically.",
    }


# ---------------------------------------------------------------------------------------------- assets
@router.post("/assets")
def upload_asset(file: UploadFile = File(...)):
    key, name = _save_upload(file, "assets", ASSET_EXT)
    return {"key": key, "filename": name}


@router.get("/music")
def music_library():
    """Tracks in the licensed music folder. Only add music you hold a licence for."""
    d = get_settings().music_library_dir
    return [{"file": f.name, "title": f.stem.replace("_", " ")} for f in sorted(d.iterdir())
            if f.suffix.lower() in {".mp3", ".wav", ".m4a", ".aac"}]


# ---------------------------------------------------------------------------------------------- dashboard
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    projects = db.scalar(select(func.count(Project.id))) or 0
    processed = db.scalar(select(func.count(Project.id)).where(Project.status == "ready")) or 0
    clips = db.scalar(select(func.count(Clip.id))) or 0
    rendered = db.scalar(select(func.count(Clip.id)).where(Clip.render_status == "rendered")) or 0
    source_minutes = sum(((p.metadata_json or {}).get("duration") or 0) for p in
                         db.scalars(select(Project).where(Project.status == "ready"))) / 60
    # Rough estimate: ~1 min of review per source minute + ~20 min of manual editing per finished clip.
    saved_minutes = round(source_minutes + rendered * 20 + (clips - rendered) * 5)
    recent = [_summary(p) for p in db.scalars(select(Project).order_by(Project.created_at.desc()).limit(6))]
    queue = [{"id": j.id, "kind": j.kind, "status": j.status, "progress": j.progress, "project_id": j.project_id,
              "clip_id": j.clip_id, "created_at": j.created_at}
             for j in db.scalars(select(Job).where(Job.status.in_(["queued", "running"]))
                                 .order_by(Job.created_at))]
    return {"total_projects": projects, "videos_processed": processed, "clips_generated": clips,
            "clips_rendered": rendered, "time_saved_minutes": saved_minutes, "recent_projects": recent,
            "queue": queue, "storage_bytes": get_storage().usage_bytes()}


@router.get("/jobs")
def jobs(active: bool = True, db: Session = Depends(get_db)):
    q = select(Job).order_by(Job.created_at.desc()).limit(100)
    if active:
        q = q.where(Job.status.in_(["queued", "running"]))
    return [{"id": j.id, "kind": j.kind, "status": j.status, "progress": j.progress, "error": j.error,
             "project_id": j.project_id, "clip_id": j.clip_id, "created_at": j.created_at} for j in db.scalars(q)]


# ---------------------------------------------------------------------------------------------- settings
ALLOWED_SETTINGS = {"brand", "ai", "account"}


@router.get("/settings/{key}")
def get_setting(key: str, db: Session = Depends(get_db)):
    if key not in ALLOWED_SETTINGS:
        raise HTTPException(404, "Unknown setting")
    s = db.get(Setting, key)
    return s.value if s else {}


@router.put("/settings/{key}")
def put_setting(key: str, body: SettingIn, db: Session = Depends(get_db)):
    if key not in ALLOWED_SETTINGS:
        raise HTTPException(404, "Unknown setting")
    s = db.get(Setting, key) or Setting(key=key)
    s.value = body.value
    db.add(s)
    db.commit()
    return s.value
