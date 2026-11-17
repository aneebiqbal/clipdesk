"use client";

import { useMemo, useRef } from "react";
import type { Moments } from "@clipdesk/types";
import { useWaveform } from "../hooks/use-waveform";
import { clock } from "../lib/format";
import { cn } from "../lib/utils";

type Tick = { left: number; major: boolean; label: string };

type Props = {
  duration: number | null;
  waveform: number[] | null;
  moments: Moments | null;
  focusStart: number | null;
  /** 0..100 position of the scan playhead while transcribing, or null. */
  scannedPct: number | null;
};

const STEPS = [60, 300, 600, 900, 1800, 3600, 7200, 14400];

export function WaveformTimeline({ duration, waveform, moments, focusStart, scannedPct }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, waveform);

  const ticks = useMemo<Tick[]>(() => {
    const dur = duration ?? 8 * 3600;
    const step = STEPS.find((s) => dur / s <= 7) ?? 14400;
    const minor = step / 4;
    const out: Tick[] = [];
    for (let t = 0; t <= dur + 0.1; t += minor) {
      const major = Math.abs(t % step) < 0.01;
      out.push({ left: (t / dur) * 100, major, label: clock(t) });
    }
    return out;
  }, [duration]);

  const dur = duration ?? 0;

  return (
    <div className="mt-5" data-duration={duration ? "true" : "false"}>
      <div className="relative h-7">
        {ticks.map((tick, i) => (
          <span
            key={i}
            className={cn("absolute bottom-0 w-px bg-muted", tick.major ? "h-2.5 opacity-90" : "h-1.5 opacity-50")}
            style={{ left: `${tick.left}%` }}
          >
            {tick.major ? (
              <span
                className={cn(
                  "absolute bottom-3 -translate-x-1/2 whitespace-nowrap text-xs tabular-nums text-muted",
                  tick.left === 0 && "translate-x-0",
                  tick.left > 93 && "-translate-x-full",
                )}
              >
                {tick.label}
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <div className="relative h-28 border-y border-line">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

        {moments && dur > 0 ? (
          <div className="pointer-events-none absolute inset-0">
            {moments.candidates.map((candidate, i) => (
              <span
                key={`c-${i}`}
                className="absolute top-0 h-3.5 w-0.5 bg-muted/70"
                style={{ left: `${(candidate.start / dur) * 100}%` }}
              />
            ))}
            {moments.selected.map((selected, i) => {
              const focused = focusStart !== null && Math.abs(selected.start - focusStart) < 0.6;
              return (
                <span
                  key={`s-${i}`}
                  className={cn(
                    "absolute bottom-0 min-w-[6px] border-l-2 border-accent bg-accent/20 transition-colors",
                    focused && "bg-accent/50",
                  )}
                  style={{
                    left: `${(selected.start / dur) * 100}%`,
                    width: `${((selected.end - selected.start) / dur) * 100}%`,
                  }}
                />
              );
            })}
          </div>
        ) : null}

        {scannedPct !== null && scannedPct > 0 ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-white/5"
              style={{ width: `${scannedPct}%` }}
            />
            <div
              className="pointer-events-none absolute -inset-y-1.5 w-0.5 bg-accent"
              style={{ left: `${scannedPct}%` }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
