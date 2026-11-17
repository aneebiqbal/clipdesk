"""Step 4-5: rank candidates and write hook/outro/title. Gemini free tier, or built-in heuristics."""
import json
import os
import random

HOOKS = [
    "Wait for it...",
    "You will not believe what happens next.",
    "This went wrong, fast.",
    "Tell me this is not insane.",
    "I did not expect that.",
    "Watch this moment.",
]
OUTROS = [
    "Full stream is on the channel.",
    "Catch the full stream on my channel.",
    "More like this on the channel.",
]


def heuristic(cands, cfg, game):
    rng = random.Random(7)
    out = []
    for c in cands:
        out.append({
            "id": c["id"], "score": c["score"] / 10.0,
            "start": c["start"], "end": c["end"],
            "hook": rng.choice(HOOKS), "outro": rng.choice(OUTROS),
            "title": f"{game} insane moment",
            "description": f"Best moment from my {game} live stream.",
        })
    return out


def _prompt(cands, game, cfg):
    blocks = []
    for c in cands:
        blocks.append(f"### CANDIDATE {c['id']} (window {c['end'] - c['start']:.0f}s)\n{c['text'] or '(no speech)'}")
    return f"""You are a YouTube Shorts editor for a {game} gaming streamer.
Below are candidate moments from a live stream (transcript lines with time offsets from the start of each window).
For EVERY candidate return one JSON object. Output ONLY a JSON array, no prose.

Fields:
- id: the candidate number
- score: 1-10, how likely it is to hold viewers (funny, shocking, skillful, emotional = high; dead air or boring = low)
- start_offset: seconds from window start where the best clip should begin (0 to 6)
- duration: clip length in seconds, between {cfg['clip_min_seconds']} and {cfg['clip_max_seconds']}
- hook: a punchy spoken line of 4-10 words for the first 3 seconds (question or bold claim)
- outro: a short spoken line (max 8 words) pointing viewers to the full stream
- title: YouTube Shorts title under 60 characters, includes "{game}"
- description: one sentence

Candidates:
{chr(10).join(blocks)}
"""


def gemini_score(cands, cfg, moments_cfg, game):
    from google import genai
    from google.genai import types

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    client = genai.Client(api_key=key)
    resp = client.models.generate_content(
        model=cfg["model"],
        contents=_prompt(cands, game, moments_cfg),
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.7),
    )
    return json.loads(resp.text)


def score_candidates(cands, cfg, moments_cfg):
    """Returns a list of clip plans: {id, score, start, end, hook, outro, title, description}."""
    game = cfg["game_name"]
    by_id = {c["id"]: c for c in cands}
    plans = None

    if cfg["provider"] == "gemini":
        try:
            raw = gemini_score(cands, cfg, moments_cfg, game)
            plans = []
            for r in raw:
                c = by_id.get(r.get("id"))
                if not c:
                    continue
                start = c["start"] + max(0.0, min(float(r.get("start_offset", 0)), 6.0))
                dur = max(moments_cfg["clip_min_seconds"],
                          min(float(r.get("duration", moments_cfg["clip_target_seconds"])), moments_cfg["clip_max_seconds"]))
                plans.append({
                    "id": c["id"], "score": float(r.get("score", 5)) + (3 if c["kind"] == "marker" else 0),
                    "start": start, "end": start + dur,
                    "hook": str(r.get("hook", "")).strip(), "outro": str(r.get("outro", "")).strip(),
                    "title": str(r.get("title", f"{game} moment"))[:95],
                    "description": str(r.get("description", "")),
                })
            print(f"  Gemini scored {len(plans)} candidates")
        except Exception as e:  # network, quota, bad JSON ... never kill the run
            print(f"  [warn] Gemini failed ({e}); using built-in heuristics")
            plans = None

    if not plans:
        plans = heuristic(cands, cfg, game)
    return plans
