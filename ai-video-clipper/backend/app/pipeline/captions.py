"""Animated word-by-word captions as Advanced SubStation Alpha (.ass), burned in by FFmpeg/libass."""
from __future__ import annotations

import re

NUMBER = re.compile(r"\d")
SENT_END = re.compile(r"[.!?…]$")

CAPTION_STYLES = {
    "bold_pop": {"label": "Bold pop", "bold": -1, "outline": 6, "shadow": 2, "border_style": 1, "pop": True},
    "boxed": {"label": "Boxed", "bold": -1, "outline": 14, "shadow": 0, "border_style": 3, "pop": False},
    "minimal": {"label": "Minimal", "bold": 0, "outline": 2.5, "shadow": 1, "border_style": 1, "pop": False},
    "karaoke": {"label": "Karaoke fill", "bold": -1, "outline": 5, "shadow": 1, "border_style": 1, "pop": False},
    "neon": {"label": "Neon glow", "bold": -1, "outline": 4, "shadow": 0, "border_style": 1, "pop": True,
             "glow": True},
}


def ass_color(hex_color: str, alpha: int = 0) -> str:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H{alpha:02X}{b}{g}{r}".upper()


def ts(t: float) -> str:
    t = max(t, 0.0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def _esc(text: str) -> str:
    return text.replace("\\", "/").replace("{", "(").replace("}", ")").replace("\n", " ")


def _norm(word: str) -> str:
    return re.sub(r"[^\w%$]", "", word.lower())


def group_words(words: list[dict], per_group: int) -> list[list[dict]]:
    groups, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        gap = (nxt["start"] - w["end"]) if nxt else 0
        if len(cur) >= per_group or SENT_END.search(w["word"]) or gap > 0.5:
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    return groups


def build_ass(words: list[dict], cfg: dict, width: int, height: int, *, emphasis: list[str] | None = None,
              hook: str | None = None, hook_seconds: float = 0.0, overlays: list[dict] | None = None,
              duration: float = 0.0) -> str:
    """`words` must already be in output-clip time (seconds from clip start)."""
    style = CAPTION_STYLES.get(cfg.get("style", "bold_pop"), CAPTION_STYLES["bold_pop"])
    scale = height / 1920
    font = cfg.get("font", "Inter")
    size = int(cfg.get("font_size", 74) * scale)
    primary = ass_color(cfg.get("primary_color", "#FFFFFF"))
    highlight = ass_color(cfg.get("highlight_color", "#FFD60A"))
    outline_col = ass_color("#000000", 0x60 if style["border_style"] == 3 else 0)
    if style.get("glow"):
        outline_col = ass_color(cfg.get("highlight_color", "#60A5FA"), 0x40)
    position = cfg.get("position", "lower")
    align, margin_v = {"top": (8, int(height * 0.16)), "middle": (5, 0)}.get(position, (2, int(height * 0.24)))
    upper = bool(cfg.get("uppercase", True))
    emph = {_norm(w) for w in (emphasis or []) if w} if cfg.get("emphasize_keywords", True) else set()

    lines = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {width}", f"PlayResY: {height}",
        "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding",
        f"Style: Caption,{font},{size},{primary},{highlight},{outline_col},&H80000000,{style['bold']},0,0,0,100,100,"
        f"0,0,{style['border_style']},{style['outline'] * scale:.1f},{style['shadow'] * scale:.1f},{align},"
        f"{int(width * 0.08)},{int(width * 0.08)},{margin_v},1",
        f"Style: Hook,{font},{int(62 * scale)},&H00111111,&H00111111,&H00FFFFFF,&H00000000,-1,0,0,0,100,100,0,0,3,"
        f"{18 * scale:.1f},0,8,{int(width * 0.1)},{int(width * 0.1)},{int(height * 0.12)},1",
        f"Style: Overlay,{font},{int(56 * scale)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,"
        f"{4 * scale:.1f},1,8,{int(width * 0.08)},{int(width * 0.08)},{int(height * 0.3)},1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    if hook and hook_seconds > 0:
        lines.append(f"Dialogue: 2,{ts(0)},{ts(hook_seconds)},Hook,,0,0,0,,{{\\fad(150,250)}}{_esc(hook)}")

    for ov in overlays or []:
        pos_align = {"top": 8, "middle": 5, "bottom": 2}.get(ov.get("position", "top"), 8)
        lines.append(f"Dialogue: 1,{ts(float(ov.get('start', 0)))},{ts(float(ov.get('end', duration)))},Overlay,,0,0,0,,"
                     f"{{\\an{pos_align}\\fad(120,120)}}{_esc(str(ov.get('text', '')))}")

    if cfg.get("enabled", True) and words:
        groups = group_words(words, max(1, int(cfg.get("words_per_group", 3))))
        for gi, group in enumerate(groups):
            g_end = group[-1]["end"] + 0.15
            if gi + 1 < len(groups):
                g_end = min(g_end, groups[gi + 1][0]["start"])
            if cfg.get("style") == "karaoke":
                parts = []
                for w in group:
                    cs = max(int((w["end"] - w["start"]) * 100), 1)
                    parts.append(f"{{\\kf{cs}}}{_esc(w['word'].upper() if upper else w['word'])}")
                lines.append(f"Dialogue: 0,{ts(group[0]['start'])},{ts(g_end)},Caption,,0,0,0,,"
                             f"{{\\1c{highlight}\\2c{primary}}}" + " ".join(parts))
                continue
            for wi, w in enumerate(group):
                start = group[0]["start"] if wi == 0 else w["start"]
                end = group[wi + 1]["start"] if wi + 1 < len(group) else g_end
                if end <= start:
                    continue
                tokens = []
                for wj, other in enumerate(group):
                    txt = _esc(other["word"].upper() if upper else other["word"])
                    is_emph = _norm(other["word"]) in emph or bool(NUMBER.search(other["word"]))
                    if wj == wi:
                        anim = "\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)" if style["pop"] else ""
                        tokens.append(f"{{\\1c{highlight}{anim}}}{txt}{{\\r}}")
                    elif is_emph:
                        tokens.append(f"{{\\1c{highlight}}}{txt}{{\\r}}")
                    else:
                        tokens.append(txt)
                lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Caption,,0,0,0,,{' '.join(tokens)}")
    return "\n".join(lines) + "\n"


def to_srt(words: list[dict], per_group: int = 7) -> str:
    """Plain SRT export (for platforms that accept caption files)."""
    def srt_ts(t: float) -> str:
        ms = int(round(max(t, 0) * 1000))
        h, ms = divmod(ms, 3600000)
        m, ms = divmod(ms, 60000)
        s, ms = divmod(ms, 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    out = []
    for i, g in enumerate(group_words(words, per_group), 1):
        out.append(f"{i}\n{srt_ts(g[0]['start'])} --> {srt_ts(g[-1]['end'])}\n{' '.join(w['word'] for w in g)}\n")
    return "\n".join(out)
