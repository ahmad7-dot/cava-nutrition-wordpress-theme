# Clipwise: AI video clipper and content repurposing

Clipwise turns long videos that you own or are licensed to use into captioned 9:16 clips for TikTok, Instagram Reels and YouTube Shorts.

It reads the whole transcript before picking anything, so each clip is a complete idea that works without the rest of the video. Every clip comes with an estimated engagement score, a hook, a caption and hashtags.

> This folder is a standalone app. It shares nothing with the WordPress theme in the rest of this repository and can be moved to its own repo as is.

## What works today (MVP)

| Area | Status |
|---|---|
| **Input** | Upload MP4/MOV/MKV/WEBM with title, niche (15 niches), platforms, clip count, duration range and language. A YouTube link is saved for reference; you then upload the original file (see "Content rights" below). |
| **Rights check** | A rights declaration (owner / licensed / permission / public domain) is required before any processing. It is stored with the project. |
| **Analysis** | ffprobe metadata, Whisper transcription with word-level timestamps (faster-whisper), PySceneDetect scene cuts, face presence and two-person layout detection. |
| **Moment detection** | Claude reads the full numbered transcript and picks clips as ranges of whole sentences. It never starts or ends mid-sentence, and only returns as many clips as the video supports. Each clip is scored 0-100 on 10 criteria: opening, curiosity, emotion, information, storytelling, relevance, clarity, retention, ending and completeness. The overall score is a weighted average computed in code. Niche guidance changes what the model looks for. With no API key, a rule-based scorer is used instead. |
| **Per-clip output** | Title, timestamps, transcript, hook plus three alternative hooks in different styles, score breakdown, reason, audience, recommended platform, caption, hashtags, keywords to emphasise, suggested value-adds and an optional posting-time hint. |
| **Reframing** | Layouts: face tracking with active-speaker estimation from mouth motion, full-screen, split screen for two people, blurred-background fill, and custom crop. The virtual camera uses a dead zone and a speed limit so it doesn't jitter. Output is 1080×1920 or 720×1280. If no face is found, it falls back gracefully instead of cropping blindly. |
| **Editing engine** | Word-by-word animated captions in 5 styles (bold pop, boxed, minimal, karaoke fill, neon), with keyword and number emphasis, configurable font size, colour and position, and platform safe zones. Also: silence and dead-air removal with captions re-timed to match, punch-in zoom on key words, hook title card, text overlays, image and logo overlays, licensed background music ducked under speech, and voiceover upload. |
| **Editor** | Live 9:16 preview, a timeline with drag-to-trim handles and word blocks, caption-word correction, style, layout and audio controls, hook regeneration, undo/redo (Ctrl+Z / Ctrl+Shift+Z), autosave, and a render with a final-result preview. |
| **Export** | MP4 with H.264 High profile and AAC, configurable bitrate and fps, `+faststart`. Per-platform title, description and hashtags with copy buttons, plus an SRT caption file. Nothing is ever posted automatically. |
| **Dashboard** | Projects, videos processed, clips generated, estimated time saved, storage used, recent projects and a live processing queue. Also pages for project history, brand settings, AI settings, subscription & usage, and account. |

### Not built yet

These are next-phase items, not in this MVP:

- Automatic stock or B-roll insertion and AI-generated voiceover (TTS). You can upload images and voiceovers today.
- Verified charts and statistics.
- Sound-effect library.
- Embedding-based semantic search across projects.
- Multimodal (vision-model) scene understanding.
- User accounts and authentication.
- Real billing.
- A neural active-speaker model. The current one is a heuristic.

The **Subscription** and **Account** pages are placeholders. Add authentication (Auth.js, Clerk, etc.) and Stripe before opening the app to the public.

## Architecture

```
frontend/  Next.js 15 · React 19 · TypeScript · Tailwind   (dashboard + editor)
   │  /api/* is proxied to the backend
backend/   FastAPI REST API
   ├── app/api/routes.py          REST endpoints
   ├── app/pipeline/media.py      ffprobe, audio extraction, silence detection, PySceneDetect
   ├── app/pipeline/segments.py   transcript → sentences → candidate windows; caption edits
   ├── app/pipeline/scoring.py    10-criterion engagement estimate + rule-based scorer
   ├── app/pipeline/reframe.py    face detection, active-speaker estimate, smooth camera path
   ├── app/pipeline/captions.py   animated ASS captions, SRT export
   ├── app/pipeline/render.py     cut → remove silence → compose 9:16 frames → FFmpeg encode
   ├── app/pipeline/runner.py     analyse-project and render-clip jobs
   ├── app/providers/llm.py       Claude provider (structured JSON output) + heuristic provider
   ├── app/providers/transcription.py   faster-whisper provider (swappable)
   ├── app/niches.py              niche strategies and default edit settings
   ├── app/storage.py             local disk or any S3-compatible store
   └── app/worker.py              Celery (Redis) or in-process thread pool
```

AI providers, transcription, storage and the queue are each behind a small interface, so any of them can be replaced without touching the pipeline.

## Run it locally

You need Python 3.11+, Node 20+ and FFmpeg (with libass) on your PATH.

**Backend**

```bash
cd ai-video-clipper/backend
```

```bash
pip install -r requirements-dev.txt
```

```bash
cp .env.example .env
```

Add your `ANTHROPIC_API_KEY` to `.env` for AI clip selection. Without it, the rule-based fallback is used. Then start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

**Frontend** (in a second terminal)

```bash
cd ai-video-clipper/frontend
```

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000.

The first transcription downloads the Whisper model you configured (`small` is about 500 MB). On a GPU, set `CLIPPER_WHISPER_DEVICE=cuda` and `CLIPPER_WHISPER_COMPUTE_TYPE=float16`.

**Background music:** put tracks you hold a licence for in `backend/data/music/`. They then appear in the editor.

### Full stack with Docker

```bash
cd ai-video-clipper
```

```bash
ANTHROPIC_API_KEY=your-key docker compose up --build
```

This starts Postgres, Redis, the API, a Celery worker and the web app. To use S3, R2 or MinIO, set `CLIPPER_STORAGE_BACKEND=s3`, the bucket and endpoint variables, and AWS credentials (see `backend/.env.example`).

### Tests

```bash
cd ai-video-clipper/backend
```

```bash
pytest -q
```

The end-to-end test builds a synthetic video, runs analysis with a stubbed transcript, edits a clip, renders it, and checks the output: 720×1280, H.264/AAC, and shorter than the source clip after silence removal.

## Notes on the AI

- **Model:** `claude-opus-5-5` with adaptive thinking and JSON-schema structured output. Server-side refusal fallback is enabled. Set `CLIPPER_LLM_MODEL` and `CLIPPER_LLM_EFFORT` to change the model or effort.
- **Prompt rules:** the system prompt requires hooks and captions to stay faithful to what is said, scores to be honest, and no padding with weak clips.
- **Cost:** one analysis call sends the full transcript once, roughly 15k tokens per hour of speech. Hook regeneration is a small separate call.
- **Scores are estimates.** The UI says this everywhere a score appears.

## Content rights

Clipwise is built for content you own, have licensed, have permission to use, or that is in the public domain.

- **No platform downloads.** It does not download from YouTube or other platforms, since their terms prohibit it.
- **No evasion.** It does not remove watermarks, alter fingerprints or try to evade copyright detection.
- **No guarantees.** It does not promise that any output is free of copyright claims.
- **Transformative additions.** The additions it supports (commentary voiceover, context cards, captions, your own images) are meant to make clips more useful, not to disguise the source.
