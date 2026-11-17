"""Step 9a: build an ASS subtitle file with big, bold, word-highlighted captions (TikTok/Shorts style)."""
import re


def _ts(t: float) -> str:
    t = max(t, 0.0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def _bgr(rrggbb: str) -> str:
    rrggbb = rrggbb.lstrip("#")
    return f"&H{rrggbb[4:6]}{rrggbb[2:4]}{rrggbb[0:2]}&"


def _clean(w: str) -> str:
    return re.sub(r"[{}\\]", "", w).upper()


def _group(words, per_line):
    groups, cur = [], []
    for w in words:
        if cur and (len(cur) >= per_line or w["start"] - cur[-1]["end"] > 0.8 or cur[-1]["word"][-1:] in ".?!"):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    return groups


def build_ass(words, cap_cfg, width, height) -> str:
    """words: [{word,start,end}] with times relative to the clip start."""
    prim, hi, outl = _bgr(cap_cfg["primary_color"]), _bgr(cap_cfg["highlight_color"]), _bgr(cap_cfg["outline_color"])
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{cap_cfg['font']},{cap_cfg['font_size']},{prim},{prim},{outl},&H80000000&,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,{cap_cfg['margin_bottom']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for grp in _group(words, cap_cfg["words_per_line"]):
        for j, w in enumerate(grp):
            start = w["start"]
            end = grp[j + 1]["start"] if j + 1 < len(grp) else w["end"] + 0.25
            if end <= start:
                end = start + 0.2
            parts = []
            for k, x in enumerate(grp):
                color = hi if k == j else prim
                parts.append(f"{{\\c{color}}}{_clean(x['word'])}")
            lines.append(f"Dialogue: 0,{_ts(start)},{_ts(end)},Cap,,0,0,0,,{' '.join(parts)}")
    return header + "\n".join(lines) + "\n"
