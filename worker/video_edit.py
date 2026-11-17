"""Steps 7-9: cut, 9:16 blurred-background layout, voice-over + ducking + music, burned captions. One FFmpeg pass."""
import subprocess
from pathlib import Path


def render_clip(src: Path, start: float, dur: float, out_path: Path, workdir: Path,
                vo_items, music: Path | None, cfg: dict):
    """
    vo_items: [{"path": Path, "offset": float}]  voice-over files placed at `offset` seconds into the clip
    The ASS file must already exist at workdir/captions.ass (ffmpeg runs with cwd=workdir).
    """
    W, H = cfg["output"]["width"], cfg["output"]["height"]
    a = cfg["audio"]

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(src)]
    for v in vo_items:
        cmd += ["-i", str(v["path"])]
    music_idx = None
    if music is not None:
        music_idx = 1 + len(vo_items)
        cmd += ["-stream_loop", "-1", "-i", str(music)]

    # --- video: blurred full-frame background + original gameplay centred (keeps face cam visible) ---
    vf = (
        # blur a quarter-size copy and scale it back up: same look, far faster to render
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"scale={W // 4}:{H // 4},boxblur=6:2,scale={W}:{H}[bg];"
        f"[0:v]scale={W}:-2[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2,ass=captions.ass[v]"
    )

    # --- audio ---
    af = [f"[0:a]aresample=44100,volume={a['original_volume']}[orig]"]
    mix_inputs = []
    if vo_items:
        vo_labels = []
        for i, v in enumerate(vo_items, start=1):
            ms = int(v["offset"] * 1000)
            af.append(f"[{i}:a]aresample=44100,adelay={ms}|{ms},volume={a['voice_volume']}[vo{i}]")
            vo_labels.append(f"[vo{i}]")
        if len(vo_labels) > 1:
            af.append(f"{''.join(vo_labels)}amix=inputs={len(vo_labels)}:normalize=0:duration=longest[vo]")
        else:
            af.append(f"{vo_labels[0]}anull[vo]")
        af.append("[vo]asplit=2[vo_sc][vo_mix]")
        # duck the stream audio while the AI voice speaks
        af.append("[orig][vo_sc]sidechaincompress=threshold=0.015:ratio=12:attack=15:release=300[main]")
        mix_inputs = ["[main]", "[vo_mix]"]
    else:
        mix_inputs = ["[orig]"]
    if music_idx is not None:
        fade_start = max(dur - 1.5, 0)
        af.append(
            f"[{music_idx}:a]aresample=44100,atrim=0:{dur:.3f},volume={a['music_volume']},"
            f"afade=t=in:d=1,afade=t=out:st={fade_start:.3f}:d=1.5[bgm]"
        )
        mix_inputs.append("[bgm]")
    af.append(f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:duration=first:normalize=0,alimiter=limit=0.95[a]")

    cmd += [
        "-filter_complex", ";".join([vf] + af),
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", str(cfg["output"]["crf"]), "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-t", f"{dur:.3f}", "-movflags", "+faststart",
        str(out_path.resolve()),
    ]
    r = subprocess.run(cmd, cwd=str(workdir), capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{r.stderr[-1500:]}")


def make_thumb(video: Path, out_jpg: Path, at: float = 1.5):
    """One poster frame per clip so the gallery never shows a black box."""
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{at}", "-i", str(video), "-frames:v", "1",
         "-vf", "scale=432:-2", "-q:v", "4", str(out_jpg)],
        check=False,
    )
