"""Step 3: find candidate highlight moments from marker phrases, audio spikes and excited speech."""
import bisect
import re
from pathlib import Path

import numpy as np

EXCITED = {
    "wow", "whoa", "omg", "insane", "crazy", "bro", "dude", "damn", "holy", "wtf",
    "nooo", "noooo", "yooo", "yoooo", "lol", "haha", "dead", "unreal", "sick", "bruh",
}


def _norm(w: str) -> str:
    return re.sub(r"[^a-z0-9']", "", w.lower())


def find_marker_hits(words, phrases):
    """Return list of (start, end) spans where a marker phrase was spoken."""
    toks = [_norm(w["word"]) for w in words]
    hits = []
    for phrase in phrases:
        p = [_norm(x) for x in phrase.split()]
        n = len(p)
        for i in range(len(toks) - n + 1):
            if toks[i:i + n] == p:
                hits.append((words[i]["start"], words[i + n - 1]["end"]))
    return sorted(hits)


def strip_markers(words, phrases):
    """Remove marker-phrase words (e.g. 'clip it') so they don't show up in captions."""
    spans = find_marker_hits(words, phrases)
    if not spans:
        return words
    return [w for w in words if not any(s - 0.01 <= w["start"] and w["end"] <= e + 0.01 for s, e in spans)]


def rms_per_second(wav: Path) -> np.ndarray:
    """Loudness per second, streamed so an 8h file never sits fully in RAM."""
    import soundfile as sf

    out = []
    with sf.SoundFile(str(wav)) as f:
        sr = f.samplerate
        for block in f.blocks(blocksize=sr, dtype="float32"):
            out.append(float(np.sqrt(np.mean(block.astype(np.float64) ** 2))))
    return np.array(out)


def energy_peaks(rms: np.ndarray, threshold: float):
    if len(rms) < 10:
        return []
    sm = np.convolve(rms, np.ones(3) / 3, mode="same")
    base = np.convolve(rms, np.ones(90) / 90, mode="same") + 1e-6
    ratio = sm / base
    floor = np.percentile(rms, 20)
    peaks = []
    for i in range(1, len(ratio) - 1):
        if ratio[i] >= ratio[i - 1] and ratio[i] > ratio[i + 1] and ratio[i] >= threshold and rms[i] > floor:
            peaks.append((float(i), float(ratio[i])))
    return peaks


def _window(center, cfg, duration):
    target = cfg["clip_target_seconds"]
    start = max(0.0, center - cfg["marker_lookback_seconds"])
    end = start + target
    if end > duration:
        end = duration
        start = max(0.0, end - target)
    return start, end


def window_text(transcript, start, end):
    lines = []
    for s in transcript["segments"]:
        if s["end"] >= start and s["start"] <= end:
            lines.append(f"[+{max(0.0, s['start'] - start):.1f}s] {s['text']}")
    return "\n".join(lines)


def find_candidates(transcript, rms, duration, cfg):
    words = transcript["words"]
    starts = [w["start"] for w in words]
    toks = [_norm(w["word"]) for w in words]

    def excited_near(t, span=8.0):
        lo, hi = bisect.bisect_left(starts, t - span), bisect.bisect_right(starts, t + span)
        count = sum(1 for k in range(lo, hi) if toks[k] in EXCITED)
        density = (hi - lo) / (2 * span)
        return count, density

    raw = []
    for s, e in find_marker_hits(words, cfg["marker_phrases"]):
        raw.append({"center": e, "score": 100.0, "kind": "marker"})
    for t, ratio in energy_peaks(rms, cfg["energy_ratio_threshold"]):
        ex, dens = excited_near(t)
        raw.append({"center": t, "score": ratio * 10 + ex * 3 + min(dens, 3) * 2, "kind": "energy"})

    raw.sort(key=lambda c: -c["score"])
    chosen = []
    for c in raw:
        if all(abs(c["center"] - o["center"]) >= cfg["min_gap_seconds"] for o in chosen):
            chosen.append(c)
        if len(chosen) >= cfg["max_candidates"]:
            break

    for i, c in enumerate(chosen):
        # energy peaks: the action IS the peak, so look back less than for marker phrases
        look = cfg["marker_lookback_seconds"] if c["kind"] == "marker" else 12
        local = dict(cfg, marker_lookback_seconds=look)
        c["start"], c["end"] = _window(c["center"], local, duration)
        c["id"] = i
        c["text"] = window_text(transcript, c["start"], c["end"])
    return chosen
