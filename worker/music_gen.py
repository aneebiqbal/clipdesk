"""Generates original background music locally, so there is zero copyright risk (no samples, no downloads).

Also: drop your own royalty-free tracks (Pixabay, YouTube Audio Library, ...) into music/ and the agent
will use them alongside the generated ones.
"""
import random
from pathlib import Path

import numpy as np

SR = 44100
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg", ".flac"}

# (name, bpm, root MIDI note, chord progression as semitone-offset triads)
PRESETS = [
    ("chill_a", 84, 57, [(0, 3, 7, 10), (5, 8, 12, 15), (3, 7, 10, 14), (7, 10, 14, 17)]),
    ("chill_b", 92, 52, [(0, 4, 7, 11), (9, 12, 16, 19), (5, 9, 12, 16), (7, 11, 14, 17)]),
    ("dark_c", 100, 50, [(0, 3, 7), (8, 12, 15), (5, 8, 12), (10, 14, 17)]),
    ("lofi_d", 78, 55, [(0, 4, 7, 11), (2, 5, 9, 12), (7, 11, 14, 17), (0, 4, 7, 11)]),
]


def _midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def _lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def make_track(path: Path, bpm: int, root: int, prog, bars: int = 16, seed: int = 0):
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    bar = beat * 4
    n = int(bar * bars * SR)
    out = np.zeros(n, dtype=np.float64)
    t_bar = np.arange(int(bar * SR)) / SR

    for b in range(bars):
        chord = prog[b % len(prog)]
        off = int(b * bar * SR)
        seg = np.zeros(len(t_bar))
        for semi in chord:
            f = _midi(root + semi)
            for detune in (-0.4, 0.0, 0.4):  # soft chorus
                seg += np.sin(2 * np.pi * f * (1 + detune / 100) * t_bar)
            seg += 0.3 * np.sin(2 * np.pi * f * 2 * t_bar)
        env = np.minimum(t_bar / 0.6, 1.0) * np.minimum((bar - t_bar) / 0.8, 1.0)
        seg *= env / (len(chord) * 3)
        out[off:off + len(seg)] += _lowpass(seg, 6) * 0.9

        # plucked arpeggio on 8th notes
        for k in range(8):
            semi = chord[(k * 2 + rng.integers(0, 2)) % len(chord)] + 12
            f = _midi(root + semi)
            tl = int(beat / 2 * SR)
            t = np.arange(tl) / SR
            pluck = np.sin(2 * np.pi * f * t) * np.exp(-t * 7) * 0.22
            s = off + int(k * beat / 2 * SR)
            out[s:s + tl] += pluck[: max(0, min(tl, n - s))]

        # soft kick on beats 1 and 3, quiet hat on off-beats
        for kb in (0, 2):
            tl = int(0.25 * SR)
            t = np.arange(tl) / SR
            kick = np.sin(2 * np.pi * (45 + 80 * np.exp(-t * 25)) * t) * np.exp(-t * 14) * 0.45
            s = off + int(kb * beat * SR)
            out[s:s + tl] += kick[: max(0, min(tl, n - s))]
        for hb in range(4):
            tl = int(0.05 * SR)
            hat = rng.standard_normal(tl) * np.exp(-np.arange(tl) / SR * 90) * 0.06
            s = off + int((hb + 0.5) * beat * SR)
            out[s:s + tl] += hat[: max(0, min(tl, n - s))]

    out /= max(np.max(np.abs(out)), 1e-6)
    out *= 0.6
    stereo = np.stack([out, np.roll(out, 90)], axis=1)  # tiny delay = width
    import soundfile as sf

    sf.write(str(path), stereo.astype(np.float32), SR)


def ensure_music(music_dir: Path):
    """Generate the built-in tracks on first run. Returns all usable tracks (generated + user-supplied)."""
    music_dir.mkdir(exist_ok=True)
    for i, (name, bpm, root, prog) in enumerate(PRESETS):
        p = music_dir / f"generated_{name}.wav"
        if not p.exists():
            print(f"  generating original music: {p.name}")
            make_track(p, bpm, root, prog, seed=i)
    return sorted(p for p in music_dir.iterdir() if p.suffix.lower() in AUDIO_EXT)


def pick(tracks, rng: random.Random):
    return rng.choice(tracks) if tracks else None
