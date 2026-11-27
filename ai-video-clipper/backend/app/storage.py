"""Object storage abstraction: local disk for dev, any S3-compatible store for production."""
import shutil
from pathlib import Path
from typing import BinaryIO, Protocol

from app.core.config import get_settings


class Storage(Protocol):
    def save_stream(self, key: str, stream: BinaryIO) -> int: ...
    def put_file(self, key: str, path: Path) -> None: ...
    def local_path(self, key: str) -> Path: ...
    def delete(self, key: str) -> None: ...
    def usage_bytes(self) -> int: ...


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)

    def _p(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root.resolve() not in p.parents:
            raise ValueError("invalid storage key")
        return p

    def save_stream(self, key: str, stream: BinaryIO) -> int:
        p = self._p(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("wb") as f:
            shutil.copyfileobj(stream, f, length=8 * 1024 * 1024)
        return p.stat().st_size

    def put_file(self, key: str, path: Path) -> None:
        p = self._p(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        if path.resolve() != p:
            shutil.copyfile(path, p)

    def local_path(self, key: str) -> Path:
        return self._p(key)

    def delete(self, key: str) -> None:
        self._p(key).unlink(missing_ok=True)

    def usage_bytes(self) -> int:
        return sum(f.stat().st_size for f in self.root.rglob("*") if f.is_file())


class S3Storage:
    """S3 / MinIO / R2. Files are cached locally for processing (FFmpeg needs a seekable file)."""

    def __init__(self, bucket: str, cache_dir: Path, endpoint_url: str | None, region: str):
        import boto3

        self.bucket = bucket
        self.cache = LocalStorage(cache_dir)
        self.s3 = boto3.client("s3", endpoint_url=endpoint_url, region_name=region)

    def save_stream(self, key: str, stream: BinaryIO) -> int:
        size = self.cache.save_stream(key, stream)
        self.s3.upload_file(str(self.cache.local_path(key)), self.bucket, key)
        return size

    def put_file(self, key: str, path: Path) -> None:
        self.s3.upload_file(str(path), self.bucket, key)
        self.cache.put_file(key, path)

    def local_path(self, key: str) -> Path:
        p = self.cache.local_path(key)
        if not p.exists():
            p.parent.mkdir(parents=True, exist_ok=True)
            self.s3.download_file(self.bucket, key, str(p))
        return p

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)
        self.cache.delete(key)

    def usage_bytes(self) -> int:
        total = 0
        for page in self.s3.get_paginator("list_objects_v2").paginate(Bucket=self.bucket):
            total += sum(o["Size"] for o in page.get("Contents", []))
        return total


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        s = get_settings()
        if s.storage_backend == "s3":
            _storage = S3Storage(s.s3_bucket, s.data_dir / "s3cache", s.s3_endpoint_url, s.s3_region)
        else:
            _storage = LocalStorage(s.data_dir / "store")
    return _storage
