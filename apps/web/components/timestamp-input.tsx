"use client";

import { useState } from "react";
import type { ManualTimestamp } from "@clipdesk/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function TimestampInput({
  duration,
  onAdd,
}: {
  duration: number | null;
  onAdd: (timestamp: ManualTimestamp) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const startSec = parseClock(start);
    const endSec = parseClock(end);
    if (startSec === null || endSec === null) {
      setError("Use HH:MM:SS for both times.");
      return;
    }
    if (endSec <= startSec) {
      setError("End must be after start.");
      return;
    }
    if (endSec - startSec > 60) {
      setError("Timestamps are limited to 60 seconds.");
      return;
    }
    if (duration !== null && endSec > duration + 0.5) {
      setError("That is past the end of the video.");
      return;
    }
    onAdd({ startSec, endSec, label: label.trim() || undefined });
    setStart("");
    setEnd("");
    setLabel("");
    setError(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={start}
          onChange={(event) => setStart(event.target.value)}
          placeholder="00:14:30"
          aria-label="Start time"
          className="font-mono"
        />
        <Input
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          placeholder="00:15:10"
          aria-label="End time"
          className="font-mono"
        />
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Label (optional)"
          aria-label="Timestamp label"
        />
        <Button type="button" variant="accent" onClick={submit} className="shrink-0">
          Add
        </Button>
      </div>
      {error ? <p className="text-xs text-accentink">{error}</p> : null}
    </div>
  );
}
