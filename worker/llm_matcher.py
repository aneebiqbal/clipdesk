"""LLM-based semantic scoring for script matching (Gemini free tier).

Falls back to keyword-only scoring on any error (network, quota, bad response).
Results are cached per (script_id, window_start) in worker/work/llm_cache.
"""
import json
import os
import re
from pathlib import Path

CACHE_DIR = Path(__file__).parent / "work" / "llm_cache"


def _cache_path(script_id, window_start):
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", str(script_id))
    return CACHE_DIR / f"{safe}_{int(window_start)}.json"


def _client():
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return None
    try:
        from google import genai

        return genai.Client(api_key=key)
    except Exception:
        return None


def _ask_batch(client, script, batch, game, cfg):
    lines = []
    for i, window in enumerate(batch):
        lines.append(f"[{i}] {window['text']}")
    prompt = f"""You are scoring how well 30-second transcript excerpts from a {game} livestream match a described moment.

Script: {script.get('description', '')}
Keywords: {', '.join(script.get('keywords', []) or [])}

Transcripts:
{chr(10).join(lines)}

For each excerpt, score 0.0 to 1.0 where 1.0 is a perfect match. Respond with ONLY a JSON array of numbers in the same order."""
    try:
        resp = client.models.generate_content(
            model=cfg.get("llm", {}).get("model", "gemini-2.5-flash-lite"),
            contents=prompt,
        )
        nums = json.loads(resp.text)
        return [max(0.0, min(1.0, float(x))) for x in nums]
    except Exception as exc:  # noqa: BLE001 - never kill the run
        print(f"  [warn] LLM matcher failed ({exc}); using keyword-only scoring")
        return [None] * len(batch)


def score_windows(script, windows, game, cfg):
    """Return a score (0..1) or None per window. None means 'use keywords'."""
    if cfg.get("llm", {}).get("provider") != "gemini":
        return [None] * len(windows)
    client = _client()
    if client is None:
        return [None] * len(windows)

    results = []
    for i in range(0, len(windows), 10):
        batch = windows[i : i + 10]
        cached = []
        missing = []
        for window in batch:
            cache = _cache_path(script["id"], window["start"])
            if cache.exists():
                try:
                    cached.append(float(json.loads(cache.read_text())))
                    continue
                except Exception:
                    pass
            cached.append(None)
            missing.append((len(cached) - 1, window))
        if missing:
            scores = _ask_batch(client, script, [w for _, w in missing], game, cfg)
            for (index, window), score in zip(missing, scores):
                cached[index] = score
                if score is not None:
                    cache = _cache_path(script["id"], window["start"])
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    cache.write_text(json.dumps(score))
        results.extend(cached)
    return results
