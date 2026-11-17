#!/usr/bin/env python3
"""JSON-lines wrapper around agent.run_pipeline.

The Node backend spawns this script and reads one JSON event per line from stdout.
It only adds transport; all pipeline logic stays in agent.py and its modules.
"""
import argparse
import json
import sys
from pathlib import Path

import agent


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", required=True)
    ap.add_argument("--clips", type=int, default=10)
    ap.add_argument("--config", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--cancel-file")
    ap.add_argument("--brief", help="path to brief.json describing topics and scripts")
    args = ap.parse_args()

    import yaml

    cfg = yaml.safe_load(Path(args.config).read_text())

    def emit(kind, **data):
        sys.stdout.write(json.dumps({"kind": kind, **data}) + "\n")
        sys.stdout.flush()

    def cancelled():
        return bool(args.cancel_file and Path(args.cancel_file).exists())

    try:
        result = agent.run_pipeline(
            args.input, args.clips, cfg, args.output, emit=emit, cancelled=cancelled,
            brief_path=args.brief,
        )
        emit("result", **result)
    except agent.Cancelled:
        emit("cancelled")
        sys.exit(3)
    except Exception as exc:  # noqa: BLE001 - report every failure to the caller
        emit("error", message=str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
