import time

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pipeline import media
from app.providers import transcription
from tests.conftest import fake_transcript


class FakeTranscriber:
    name = "fake"

    def transcribe(self, audio_path, language, progress):
        progress(1.0)
        return fake_transcript()


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr("app.pipeline.runner.get_transcriber", lambda: FakeTranscriber())
    with TestClient(app) as c:
        yield c


def _wait(fn, timeout=240):
    end = time.time() + timeout
    while time.time() < end:
        result = fn()
        if result:
            return result
        time.sleep(0.5)
    raise AssertionError("timed out")


def test_rights_declaration_required(client, sample_video):
    with sample_video.open("rb") as f:
        r = client.post("/api/projects", data={"title": "x", "rights_basis": "owner", "rights_confirmed": "false"},
                        files={"file": ("a.mp4", f, "video/mp4")})
    assert r.status_code == 400


def test_youtube_url_waits_for_upload(client):
    r = client.post("/api/projects", data={"title": "yt", "rights_basis": "owner", "rights_confirmed": "true",
                                           "source_url": "https://www.youtube.com/watch?v=abc"})
    assert r.status_code == 200 and r.json()["status"] == "awaiting_upload"


def test_full_pipeline(client, sample_video):
    with sample_video.open("rb") as f:
        r = client.post("/api/projects", data={
            "title": "Founder lessons", "niche": "business", "rights_basis": "owner", "rights_confirmed": "true",
            "desired_clips": "3", "min_duration": "10", "max_duration": "30"},
            files={"file": ("talk.mp4", f, "video/mp4")})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]

    def ready():
        p = client.get(f"/api/projects/{pid}").json()
        if p["status"] == "failed":
            raise AssertionError(p["error"])
        return p if p["status"] == "ready" else None

    project = _wait(ready)
    assert project["clips"], "expected clips"
    assert project["analysis"]["provider"] == "heuristic"
    clip = project["clips"][0]
    assert 0 <= clip["score"] <= 100 and len(clip["alt_hooks"]) == 3

    words = client.get(f"/api/clips/{clip['id']}/words?pad=0").json()["words"]
    assert words and words[0]["start"] >= clip["start"] - 0.5
    fixed = {"start": words[0]["start"], "end": words[0]["end"], "word": "EDITED"}
    r = client.patch(f"/api/clips/{clip['id']}", json={"edit_settings": {"word_overrides": [fixed]}})
    assert r.status_code == 200
    again = client.get(f"/api/clips/{clip['id']}/words?pad=0").json()
    assert again["edited"] and again["words"][0]["word"] == "EDITED"
    assert "EDITED" in client.get(f"/api/clips/{clip['id']}/srt").text

    r = client.patch(f"/api/clips/{clip['id']}", json={
        "hook": "One rule changed everything",
        "edit_settings": {"resolution": "720x1280", "layout": "blur",
                          "captions": {"style": "boxed"},
                          "text_overlays": [{"text": "Lesson #1", "start": 0.5, "end": 3, "position": "top"}]}})
    assert r.status_code == 200 and r.json()["edit_settings"]["captions"]["style"] == "boxed"

    client.post(f"/api/clips/{clip['id']}/render")

    def rendered():
        c = client.get(f"/api/clips/{clip['id']}").json()
        if c["render_status"] == "failed":
            raise AssertionError(c["render_error"])
        return c if c["render_status"] == "rendered" else None

    _wait(rendered)
    from app.storage import get_storage
    out = get_storage().local_path(client.get(f"/api/clips/{clip['id']}").json()["output_key"])
    info = media.probe(out)
    assert (info["width"], info["height"]) == (720, 1280)
    assert info["video_codec"] == "h264" and info["audio_codec"] == "aac"
    # silence removal shortened the clip
    assert info["duration"] < clip["end"] - clip["start"]

    meta = client.get(f"/api/clips/{clip['id']}/export?platform=youtube_shorts").json()
    assert meta["video"]["video_codec"] == "h264" and meta["download_url"]
    assert client.get(f"/api/clips/{clip['id']}/download").status_code == 200

    dash = client.get("/api/dashboard").json()
    assert dash["clips_generated"] >= 1 and dash["clips_rendered"] >= 1
