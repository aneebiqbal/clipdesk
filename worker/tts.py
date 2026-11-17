"""Step 6: AI voice-over with Edge TTS (free). Returns audio file + word timings for captions."""
import asyncio
import subprocess
from pathlib import Path


def _duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


async def _synth(text, voice, rate, out_mp3: Path):
    import edge_tts

    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:  # older edge-tts without the boundary argument
        comm = edge_tts.Communicate(text, voice, rate=rate)
    words = []
    with open(out_mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                s = chunk["offset"] / 1e7
                words.append({"word": chunk["text"], "start": s, "end": s + chunk["duration"] / 1e7})
    return words


def speak(text: str, out_mp3: Path, tts_cfg: dict):
    """Returns {"path", "duration", "words"} or None if synthesis failed (agent then skips voice-over)."""
    if not text.strip():
        return None
    try:
        words = asyncio.run(_synth(text, tts_cfg["voice"], tts_cfg.get("rate", "+0%"), out_mp3))
        dur = _duration(out_mp3)
    except Exception as e:
        print(f"  [warn] TTS failed ({e}); continuing without voice-over")
        return None
    if not words:  # no boundary events: spread words evenly
        toks = text.split()
        step = dur / max(len(toks), 1)
        words = [{"word": t, "start": i * step, "end": (i + 1) * step} for i, t in enumerate(toks)]
    return {"path": out_mp3, "duration": dur, "words": words}
