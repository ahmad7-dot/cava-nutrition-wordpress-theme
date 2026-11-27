"""Application settings, loaded from environment variables (or a .env file)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CLIPPER_", extra="ignore")

    # Core
    app_name: str = "Clipwise"
    database_url: str = "sqlite:///./data/clipper.db"  # use postgresql+psycopg://... in production
    data_dir: Path = Path("./data")
    cors_origins: list[str] = ["http://localhost:3000"]
    max_upload_mb: int = 4096

    # Storage: "local" or "s3"
    storage_backend: str = "local"
    s3_bucket: str = ""
    s3_endpoint_url: str | None = None  # set for MinIO / R2 / other S3-compatible stores
    s3_region: str = "us-east-1"

    # Queue: when redis_url is set and use_celery is true, jobs go to Celery workers.
    # Otherwise they run in an in-process thread pool (fine for local dev / single box).
    use_celery: bool = False
    redis_url: str = "redis://localhost:6379/0"
    inline_workers: int = 2

    # Transcription
    transcription_provider: str = "faster_whisper"  # or "none" (testing only)
    whisper_model: str = "small"  # tiny, base, small, medium, large-v3
    whisper_device: str = "auto"
    whisper_compute_type: str = "int8"

    # LLM (highlight detection, hooks, captions). Key is read from ANTHROPIC_API_KEY.
    llm_provider: str = "anthropic"  # or "heuristic" (no API calls)
    llm_model: str = "claude-opus-5-5"
    llm_effort: str = "high"

    # Licensed music library folder (only files you have rights to use)
    music_library_dir: Path = Path("./data/music")

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def work_dir(self) -> Path:
        return self.data_dir / "work"

    @property
    def outputs_dir(self) -> Path:
        return self.data_dir / "outputs"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    for d in (s.data_dir, s.uploads_dir, s.work_dir, s.outputs_dir, s.music_library_dir):
        d.mkdir(parents=True, exist_ok=True)
    return s
