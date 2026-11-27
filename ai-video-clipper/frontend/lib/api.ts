export const API = process.env.NEXT_PUBLIC_API_URL || "";

export type Hook = { style: string; text: string };

export type CaptionSettings = {
  enabled: boolean;
  style: string;
  font: string;
  font_size: number;
  primary_color: string;
  highlight_color: string;
  position: "top" | "middle" | "lower";
  uppercase: boolean;
  words_per_group: number;
  emphasize_keywords: boolean;
};

export type TextOverlay = { text: string; start: number; end: number; position: "top" | "middle" | "bottom" };
export type ImageOverlay = { key: string; filename?: string; start: number; end: number; x: number; y: number; width: number };
export type Word = { start: number; end: number; word: string };

export type EditSettings = {
  layout: string;
  custom_crop_x: number;
  face_zoom: number;
  resolution: string;
  fps: number;
  video_bitrate: string;
  audio_bitrate: string;
  captions: CaptionSettings;
  remove_silence: boolean;
  silence_threshold_db: number;
  min_silence: number;
  zoom_on_emphasis: boolean;
  zoom_strength: number;
  text_overlays: TextOverlay[];
  image_overlays: ImageOverlay[];
  hook_overlay: boolean;
  hook_overlay_seconds: number;
  music: { file: string; volume: number } | null;
  voice_volume: number;
  voiceover: { key: string; filename?: string; start: number; volume: number } | null;
  trim_start_offset: number;
  trim_end_offset: number;
  word_overrides?: Word[];
  _last_render?: Record<string, unknown>;
};

export type Clip = {
  id: string;
  project_id: string;
  project_title?: string;
  title: string;
  start: number;
  end: number;
  transcript_text: string;
  hook: string;
  alt_hooks: Hook[];
  score: number;
  score_breakdown: Record<string, number>;
  reason: string;
  target_audience: string;
  recommended_platform: string;
  caption: string;
  hashtags: string[];
  emphasis_words: string[];
  value_adds: string[];
  suggested_post_time: string;
  edit_settings: EditSettings;
  approved: boolean;
  render_status: "draft" | "queued" | "rendering" | "rendered" | "failed";
  render_progress: number;
  render_error: string | null;
  output_key: string | null;
  rendered_at: string | null;
  updated_at: string;
};

export type Project = {
  id: string;
  title: string;
  niche: string;
  status: "awaiting_upload" | "queued" | "processing" | "ready" | "failed";
  progress: number;
  stage: string;
  error: string | null;
  source_url: string | null;
  source_filename: string | null;
  desired_clips: number;
  min_duration: number;
  max_duration: number;
  target_platforms: string[];
  language: string;
  rights_basis: string;
  metadata_json: { duration?: number; width?: number; height?: number; fps?: number; size_bytes?: number };
  created_at: string;
  clip_count: number;
  analysis?: {
    summary?: string;
    topics?: string[];
    scene_count?: number;
    sentence_count?: number;
    provider?: string;
    language?: string;
    clips_found?: number;
    visual?: { face_presence: number; typical_people_on_screen: number; two_person_layout: boolean };
    note?: string;
  };
  clips?: Clip[];
};

export type Options = {
  niches: Record<string, string>;
  platforms: Record<string, { label: string; max_seconds: number }>;
  rights_bases: Record<string, string>;
  caption_styles: Record<string, string>;
  layouts: Record<string, string>;
  resolutions: string[];
  durations: number[];
  llm_provider: string;
};

export type Dashboard = {
  total_projects: number;
  videos_processed: number;
  clips_generated: number;
  clips_rendered: number;
  time_saved_minutes: number;
  storage_bytes: number;
  recent_projects: Project[];
  queue: { id: string; kind: string; status: string; progress: number; project_id: string; clip_id: string | null }[];
};

export class ApiError extends Error {}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {}
    throw new ApiError(msg);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => fetch(`${API}${path}`, { cache: "no-store" }).then((r) => handle<T>(r)),
  send: <T>(path: string, method: string, body?: unknown) =>
    fetch(`${API}${path}`, {
      method,
      headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => handle<T>(r)),
};

/** Upload with progress (fetch has no upload progress events). */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (p: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}${path}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new ApiError(typeof body.detail === "string" ? body.detail : xhr.statusText));
      } catch {
        reject(new ApiError(xhr.statusText || "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload"));
    xhr.send(form);
  });
}

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
};
export const fmtDuration = (s?: number) => {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
};
export const fmtBytes = (b: number) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"], i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), 4);
  return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};
export const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", instagram_reels: "Instagram Reels", youtube_shorts: "YouTube Shorts",
};
export const CRITERIA_LABEL: Record<string, string> = {
  opening: "Opening", curiosity: "Curiosity", emotion: "Emotion", information: "Information",
  storytelling: "Storytelling", relevance: "Relevance", clarity: "Clarity", retention: "Retention",
  ending: "Ending", completeness: "Complete idea",
};
