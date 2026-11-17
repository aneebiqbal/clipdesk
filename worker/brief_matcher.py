"""Multi-signal moment matcher.

Combines script (keyword + LLM), energy (existing find_moments logic) and
manual-timestamp candidates into one scored, deduplicated list.
"""
import bisect
import re
import uuid

DEFAULTS = {
    "window_seconds": 30.0,
    "window_step_seconds": 5.0,
    "threshold": 0.3,
    "max_windows_per_script": 3,
    "min_gap_seconds": 45.0,
    "max_clip_duration": 30.0,
}


def _opts(cfg):
    opts = dict(DEFAULTS)
    opts.update(cfg.get("brief_matcher", {}) or {})
    return opts


def _keyword_score(keywords, text):
    if not keywords:
        return 0.0
    low = text.lower()
    hits = sum(1 for kw in keywords if re.search(r"\b" + re.escape(kw.lower()) + r"\b", low))
    return hits / len(keywords)


def match_scripts(transcript_words, brief, cfg):
    """Score sliding transcript windows against every scripted topic's scripts."""
    opts = _opts(cfg)
    window_seconds = opts["window_seconds"]
    step = opts["window_step_seconds"]
    threshold = opts["threshold"]
    words = transcript_words or []
    if not words:
        return []
    times = [w["start"] for w in words]
    duration = times[-1]

    candidates = []
    for topic in brief.get("topics", []):
        if topic.get("type") != "scripted":
            continue
        for script in topic.get("scripts", []) or []:
            keywords = [k for k in (script.get("keywords") or []) if str(k).strip()]
            windows = []
            t = 0.0
            while t <= duration:
                lo = bisect.bisect_left(times, t)
                hi = bisect.bisect_left(times, t + window_seconds)
                window_words = words[lo:hi]
                if window_words:
                    text = " ".join(w["word"] for w in window_words)
                    ks = _keyword_score(keywords, text)
                    if ks > 0:
                        windows.append(
                            {
                                "start": window_words[0]["start"],
                                "end": window_words[-1]["end"],
                                "text": text,
                                "keyword_score": ks,
                            }
                        )
                t += step
            if not windows:
                continue

            semantic = None
            if cfg.get("llm", {}).get("provider") == "gemini":
                import llm_matcher

                semantic = llm_matcher.score_windows(
                    script, windows, brief.get("game", ""), cfg
                )

            scored = []
            for index, window in enumerate(windows):
                sem = semantic[index] if semantic else None
                score = sem if sem is not None else window["keyword_score"]
                method = "semantic" if sem is not None else "keyword"
                scored.append((score, method, window))
            scored.sort(key=lambda item: -item[0])

            chosen = []
            for score, method, window in scored:
                if score < threshold:
                    break
                if all(
                    abs(window["start"] - c["start"]) >= opts["min_gap_seconds"] for c in chosen
                ):
                    chosen.append(
                        {
                            "start": window["start"],
                            "end": window["end"],
                            "center": (window["start"] + window["end"]) / 2,
                            "score": score * 100.0,
                            "kind": "script",
                            "text": window["text"],
                            "topic_id": topic["id"],
                            "script_id": script["id"],
                            "match_score": score,
                            "match_method": method,
                        }
                    )
                if len(chosen) >= opts["max_windows_per_script"]:
                    break
            candidates.extend(chosen)
    return candidates


def match_manual_timestamps(timestamps):
    out = []
    for ts in timestamps or []:
        start = float(ts["start"])
        end = float(ts["end"])
        out.append(
            {
                "start": start,
                "end": end,
                "center": (start + end) / 2,
                "score": 100.0,
                "kind": "manual",
                "text": ts.get("label") or "",
                "topic_id": ts.get("topic_id") or "builtin-timestamps",
                "script_id": None,
                "match_score": 1.0,
                "match_method": "manual",
            }
        )
    return out


def _overlap(a, b):
    lo = max(a["start"], b["start"])
    hi = min(a["end"], b["end"])
    if hi <= lo:
        return 0.0
    overlap = hi - lo
    return overlap / max(1e-6, min(a["end"] - a["start"], b["end"] - b["start"]))


def merge_all_candidates(script_candidates, energy_candidates, manual_candidates, cfg):
    opts = _opts(cfg)
    combined = []
    for candidate in list(script_candidates) + list(energy_candidates) + list(manual_candidates):
        item = dict(candidate)
        if "match_method" not in item:
            item["match_method"] = "energy" if item.get("kind") in ("energy", "marker") else "keyword"
        if "match_score" not in item:
            item["match_score"] = float(item.get("score", 0)) / 100.0
        combined.append(item)
    combined.sort(key=lambda item: -item["score"])

    merged = []
    for candidate in combined:
        overlap = next((m for m in merged if _overlap(candidate, m) > 0.5), None)
        if overlap is None:
            merged.append(candidate)
        else:
            methods = {overlap.get("match_method"), candidate.get("match_method")}
            if len(methods) > 1:
                overlap["match_method"] = "hybrid"

    merged.sort(key=lambda item: -item["score"])
    final = []
    for candidate in merged:
        if all(
            abs(candidate["center"] - kept["center"]) >= opts["min_gap_seconds"] for kept in final
        ):
            final.append(candidate)
    final.sort(key=lambda item: item["start"])
    for index, candidate in enumerate(final):
        candidate["id"] = index
    return final


def _split_points(candidate, words, max_clip_duration):
    start, end = candidate["start"], candidate["end"]
    duration = end - start
    target = min(max_clip_duration, 28.0)
    parts = max(2, int(round(duration / target)))

    pauses = []
    if words:
        for a, b in zip(words, words[1:]):
            if b["start"] - a["end"] >= 1.0:
                mid = (a["end"] + b["start"]) / 2
                if start < mid < end:
                    pauses.append(mid)

    splits = []
    for k in range(1, parts):
        ideal = start + duration * k / parts
        if pauses:
            best = min(pauses, key=lambda p: abs(p - ideal))
            if best not in splits:
                splits.append(best)
        else:
            splits.append(ideal)
    splits = sorted(set(splits))
    points = [start] + splits + [end]
    return [(points[i], points[i + 1]) for i in range(len(points) - 1)]


def detect_series(candidates, transcript_words=None, rms=None, max_clip_duration=30.0):
    """Split long script matches into a multi-part series."""
    out = []
    for candidate in candidates:
        duration = candidate["end"] - candidate["start"]
        if not candidate.get("script_id") or duration <= max_clip_duration:
            out.append(candidate)
            continue
        group = str(uuid.uuid4())
        parts = _split_points(candidate, transcript_words, max_clip_duration)
        for index, (start, end) in enumerate(parts, start=1):
            part = dict(candidate)
            part["start"] = start
            part["end"] = end
            part["center"] = (start + end) / 2
            part["series_group"] = group
            part["series_part"] = index
            out.append(part)
    return out
