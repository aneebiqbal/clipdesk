"""Step 1-2: extract audio and transcribe with word-level timestamps (faster-whisper, free/local)."""
import json
import subprocess
from pathlib import Path


def probe_duration(path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def extract_audio(video: Path, out_wav: Path) -> Path:
    if out_wav.exists():
        return out_wav
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-vn",
         "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le", str(out_wav)],
        check=True,
    )
    return out_wav


def transcribe(audio_wav: Path, cfg: dict, out_json: Path, on_progress=None) -> dict:
    """Returns {"words": [{word,start,end}], "segments": [{start,end,text}]}. Cached on disk.

    on_progress(fraction 0..1) is called as the transcription advances.
    """
    if out_json.exists():
        return json.loads(out_json.read_text())

    from faster_whisper import WhisperModel

    print(f"  loading whisper model '{cfg['model']}' (first run downloads it) ...")
    model = WhisperModel(cfg["model"], compute_type=cfg.get("compute_type", "int8"))
    segments, info = model.transcribe(
        str(audio_wav),
        word_timestamps=True,
        language=cfg.get("language"),
        vad_filter=True,
    )
    total = info.duration or 1
    words, segs, next_report = [], [], 0.0
    for s in segments:
        segs.append({"start": s.start, "end": s.end, "text": s.text.strip()})
        for w in (s.words or []):
            words.append({"word": w.word.strip(), "start": w.start, "end": w.end})
        if on_progress:
            on_progress(min(s.end / total, 1.0))
        if s.end / total >= next_report:
            print(f"  transcribed {s.end / 60:.0f} / {total / 60:.0f} min")
            next_report += 0.1
    data = {"words": words, "segments": segs}
    out_json.write_text(json.dumps(data))
    return data
