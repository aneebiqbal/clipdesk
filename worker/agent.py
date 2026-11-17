#!/usr/bin/env python3
"""
Shorts Agent: turn a downloaded YouTube stream into ready-to-upload 9:16 Shorts
with AI hook/outro voice-over, word-highlighted captions and copyright-free background music.

    python agent.py --input stream.mp4 --clips 10      (command line)
    python server.py                                   (web app)
"""
import argparse
import hashlib
import json
import random
import re
import time
from pathlib import Path

import numpy as np
import yaml

import brief_matcher
import caption_gen
import find_moments
import llm_scorer
import music_gen
import transcribe
import tts
import video_edit

ROOT = Path(__file__).parent


class Cancelled(Exception):
    pass


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "clip"


def pick_non_overlapping(plans, n):
    chosen = []
    for p in sorted(plans, key=lambda x: -x["score"]):
        if all(p["end"] <= c["start"] or p["start"] >= c["end"] for c in chosen):
            chosen.append(p)
        if len(chosen) >= n:
            break
    return chosen


def _waveform(rms: np.ndarray, bins: int = 240):
    """Downsample per-second loudness to `bins` values in 0..1 for the UI timeline."""
    if len(rms) == 0:
        return [0.0] * bins
    chunks = np.array_split(rms, min(bins, len(rms)))
    vals = np.array([c.max() for c in chunks])
    top = np.percentile(vals, 98) or 1.0
    return [round(float(v), 3) for v in np.sqrt(np.clip(vals / top, 0, 1))]


def _cli_emit(kind, **d):
    if kind == "progress" and d.get("message"):
        print(f"[{d['stage']}/5] {d['message']}")
    elif kind == "log":
        print("  " + d["message"])
    elif kind == "clip":
        print(f"  done: {d['meta']['file']}")


def _candidate_view(c):
    view = {"start": c["start"], "end": c["end"], "score": c["score"], "kind": c["kind"]}
    for field in ("text", "topic_id", "script_id", "match_score", "match_method", "series_group", "series_part"):
        if field in c:
            view[field] = c[field]
    return view


def run_pipeline(src, clips, cfg, out_root, emit=None, cancelled=None, transcript_path=None, brief_path=None):
    """
    Full pipeline. Progress is reported through emit(kind, **data):
      run(name) duration(seconds) progress(stage, pct, message) waveform(values)
      moments(candidates, selected) topics(matches) clip(meta) log(message)
    Raises Cancelled if cancelled() returns True between steps.
    """
    emit = emit or _cli_emit
    cancelled = cancelled or (lambda: False)

    def check():
        if cancelled():
            raise Cancelled()

    src = Path(src).resolve()
    st = src.stat()
    key = f"{slug(src.stem)}-{hashlib.md5(f'{st.st_size}-{int(st.st_mtime)}'.encode()).hexdigest()[:6]}"
    work = ROOT / "work" / key
    work.mkdir(parents=True, exist_ok=True)

    brief = None
    if brief_path and Path(brief_path).exists():
        brief = json.loads(Path(brief_path).read_text())
    if brief is None and (work / "brief.json").exists():
        brief = json.loads((work / "brief.json").read_text())

    run = f"{slug(src.stem)}-{time.strftime('%m%d-%H%M')}"
    out_dir = Path(out_root) / run
    n = 2
    while out_dir.exists():
        out_dir = Path(out_root) / f"{run}-{n}"
        n += 1
    out_dir.mkdir(parents=True)
    emit("run", name=out_dir.name)

    # 1. audio
    emit("progress", stage=1, pct=1, message="Reading the audio")
    duration = transcribe.probe_duration(src)
    emit("duration", seconds=duration)
    wav = transcribe.extract_audio(src, work / "audio.wav")
    check()

    # 2. transcript
    emit("progress", stage=2, pct=5, message="Loading the speech model (first run downloads about 150 MB)")
    if transcript_path:
        transcript = json.loads(Path(transcript_path).read_text())
    else:
        def on_prog(f):
            emit("progress", stage=2, pct=5 + 45 * f, message=f"Transcribing, {f * 100:.0f}% of the stream", frac=f)
            check()

        transcript = transcribe.transcribe(wav, cfg["whisper"], work / "transcript.json", on_progress=on_prog)
    emit("log", message=f"{len(transcript['words'])} words transcribed")
    check()

    # 3. moments
    emit("progress", stage=3, pct=52, message="Looking for loud, exciting moments")
    rms = find_moments.rms_per_second(wav)
    emit("waveform", values=_waveform(rms))
    energy_cands = find_moments.find_candidates(transcript, rms, duration, cfg["moments"])
    if brief:
        script_cands = brief_matcher.match_scripts(transcript["words"], brief, cfg)
        manual_cands = []
        for topic in brief.get("topics", []):
            if topic.get("type") == "manual":
                manual_cands += brief_matcher.match_manual_timestamps(topic.get("timestamps", []))
        cands = brief_matcher.merge_all_candidates(script_cands, energy_cands, manual_cands, cfg)
        cands = brief_matcher.detect_series(cands, transcript["words"], rms)
        counts = {}
        for c in cands:
            tid = c.get("topic_id")
            if tid:
                counts[tid] = counts.get(tid, 0) + 1
        emit("topics", topics=[
            {
                "topicId": tid,
                "topicName": next(
                    (t.get("name", "") for t in brief.get("topics", []) if t.get("id") == tid),
                    tid,
                ),
                "matchCount": count,
            }
            for tid, count in counts.items()
        ])
    else:
        cands = energy_cands
    n_marker = sum(c["kind"] == "marker" for c in cands)
    emit("log", message=f"{len(cands)} candidates, {n_marker} from your marker phrase")
    emit("moments", candidates=[_candidate_view(c) for c in cands], selected=[])
    if not cands:
        raise RuntimeError("No moments found. Say your marker phrase during streams, or lower the loudness threshold in config.yaml.")
    check()

    # 4. rank
    emit("progress", stage=4, pct=57, message="Picking the best moments and writing hooks")
    tag_by_id = {c["id"]: c for c in cands}
    plans = llm_scorer.score_candidates(cands, cfg["llm"], cfg["moments"])
    for p in plans:
        source = tag_by_id.get(p.get("id"))
        if source:
            for field in ("topic_id", "script_id", "match_score", "match_method", "series_group", "series_part"):
                if field in source:
                    p[field] = source[field]
    chosen = pick_non_overlapping(plans, clips)
    chosen.sort(key=lambda p: p["start"])
    emit("moments", candidates=[_candidate_view(c) for c in cands],
         selected=[{"start": p["start"], "end": p["end"]} for p in chosen])
    check()

    tracks = []
    if cfg["audio"]["music_enabled"]:
        tracks = music_gen.ensure_music(ROOT / "music")
    rng = random.Random(42)

    # 5. render
    manifest = []
    total = len(chosen)
    for i, p in enumerate(chosen, start=1):
        check()
        base = 60 + 40 * (i - 1) / total
        emit("progress", stage=5, pct=base, message=f"Making clip {i} of {total}")
        dur = p["end"] - p["start"]
        title = p["title"]
        if p.get("series_part"):
            title = f"{title} (Part {p['series_part']})"
        name = f"{i:02d}_{slug(title)}"
        cw = work / name
        cw.mkdir(exist_ok=True)

        vo_items, vo_words, vo_spans = [], [], []
        if cfg["tts"]["enabled"]:
            hook = tts.speak(p["hook"], cw / "hook.mp3", cfg["tts"]) if p["hook"] else None
            outro = tts.speak(p["outro"], cw / "outro.mp3", cfg["tts"]) if p["outro"] else None
            for item, offset in ((hook, 0.2), (outro, None)):
                if not item:
                    continue
                if offset is None:
                    offset = dur - item["duration"] - 0.4
                    if offset < 6:
                        continue
                vo_items.append({"path": item["path"], "offset": offset})
                vo_spans.append((offset, offset + item["duration"] + 0.1))
                vo_words += [{"word": w["word"], "start": offset + w["start"], "end": offset + w["end"]} for w in item["words"]]

        speech = find_moments.strip_markers(transcript["words"], cfg["moments"]["marker_phrases"])
        clip_words = [
            {"word": w["word"], "start": w["start"] - p["start"], "end": w["end"] - p["start"]}
            for w in speech if w["start"] >= p["start"] and w["end"] <= p["end"]
        ]
        clip_words = [w for w in clip_words if not any(s <= (w["start"] + w["end"]) / 2 <= e for s, e in vo_spans)]
        all_words = sorted(clip_words + vo_words, key=lambda w: w["start"])
        ass = caption_gen.build_ass(all_words, cfg["captions"], cfg["output"]["width"], cfg["output"]["height"])
        (cw / "captions.ass").write_text(ass, encoding="utf-8")

        music = music_gen.pick(tracks, rng) if tracks else None
        out_mp4 = out_dir / f"{name}.mp4"
        video_edit.render_clip(src, p["start"], dur, out_mp4, cw, vo_items, music, cfg)
        thumb = out_dir / f"{name}.jpg"
        video_edit.make_thumb(out_mp4, thumb)

        meta = {
            "file": out_mp4.name, "title": title,
            "description": p["description"] + f"\n\n#Shorts #{slug(cfg['llm']['game_name']).replace('-', '')} #gaming",
            "source_start": round(p["start"], 1), "source_end": round(p["end"], 1),
            "duration": round(dur, 1), "score": round(p["score"], 1),
            "music": music.name if music else None, "hook": p["hook"], "outro": p["outro"],
            "thumb": thumb.name if thumb.exists() else None,
            "topic_id": p.get("topic_id"),
            "script_id": p.get("script_id"),
            "match_score": p.get("match_score"),
            "match_method": p.get("match_method"),
            "series_group": p.get("series_group"),
            "series_part": p.get("series_part"),
        }
        (out_dir / f"{name}.json").write_text(json.dumps(meta, indent=2))
        manifest.append(meta)
        (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
        emit("clip", meta=meta)
        emit("progress", stage=5, pct=60 + 40 * i / total, message=f"Made clip {i} of {total}")

    emit("progress", stage=5, pct=100, message="Done")
    return {"run": out_dir.name, "out_dir": str(out_dir), "clips": manifest}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True, help="downloaded stream video (mp4/mkv/webm)")
    ap.add_argument("--clips", type=int, default=10, help="how many Shorts to make")
    ap.add_argument("--config", default=str(ROOT / "config.yaml"))
    ap.add_argument("--output", default=str(ROOT / "output"))
    ap.add_argument("--no-llm", action="store_true", help="skip Gemini, use built-in heuristics")
    ap.add_argument("--no-tts", action="store_true", help="no AI voice-over (captions + music only)")
    ap.add_argument("--no-music", action="store_true", help="no background music")
    ap.add_argument("--transcript", help="use an existing transcript JSON instead of running Whisper")
    args = ap.parse_args()

    cfg = yaml.safe_load(Path(args.config).read_text())
    if args.no_llm:
        cfg["llm"]["provider"] = "none"
    if args.no_tts:
        cfg["tts"]["enabled"] = False
    if args.no_music:
        cfg["audio"]["music_enabled"] = False

    res = run_pipeline(args.input, args.clips, cfg, args.output, transcript_path=args.transcript)
    print(f"\nDone. {len(res['clips'])} Shorts in: {res['out_dir']}")


if __name__ == "__main__":
    main()
