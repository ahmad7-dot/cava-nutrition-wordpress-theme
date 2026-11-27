"""Background job dispatch.

Production: set CLIPPER_USE_CELERY=true and run `celery -A app.worker.celery_app worker`.
Development: jobs run in an in-process thread pool, no Redis needed.
"""
from concurrent.futures import ThreadPoolExecutor

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Job

_settings = get_settings()
celery_app = None
if _settings.use_celery:
    from celery import Celery

    celery_app = Celery("clipper", broker=_settings.redis_url, backend=_settings.redis_url)
    celery_app.conf.task_acks_late = True
    celery_app.conf.worker_prefetch_multiplier = 1

    @celery_app.task(name="clipper.analyze")
    def analyze_task(project_id: str, job_id: str):
        from app.pipeline.runner import analyze_project
        analyze_project(project_id, job_id)

    @celery_app.task(name="clipper.render")
    def render_task(clip_id: str, job_id: str):
        from app.pipeline.runner import render
        render(clip_id, job_id)

_pool = ThreadPoolExecutor(max_workers=_settings.inline_workers, thread_name_prefix="clipper")


def _new_job(kind: str, project_id: str | None, clip_id: str | None = None) -> str:
    db = SessionLocal()
    try:
        job = Job(kind=kind, project_id=project_id, clip_id=clip_id)
        db.add(job)
        db.commit()
        return job.id
    finally:
        db.close()


def enqueue_analysis(project_id: str) -> str:
    job_id = _new_job("analyze", project_id)
    if celery_app:
        celery_app.send_task("clipper.analyze", args=[project_id, job_id])
    else:
        from app.pipeline.runner import analyze_project
        _pool.submit(analyze_project, project_id, job_id)
    return job_id


def enqueue_render(clip_id: str, project_id: str) -> str:
    job_id = _new_job("render", project_id, clip_id)
    if celery_app:
        celery_app.send_task("clipper.render", args=[clip_id, job_id])
    else:
        from app.pipeline.runner import render
        _pool.submit(render, clip_id, job_id)
    return job_id
