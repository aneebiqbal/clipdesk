"use client";

import type { Job } from "@clipdesk/types";
import { cn } from "../lib/utils";

const STAGES = [
  "Reading audio",
  "Transcribing",
  "Finding moments",
  "Picking the best",
  "Making clips",
];

export function JobProgress({ job }: { job: Job | null }) {
  const status = job?.status ?? "QUEUED";
  const stage = job?.progress?.stage ?? 1;
  const done = status === "COMPLETED";
  const failed = status === "FAILED";
  const cancelled = status === "CANCELLED";
  const running = status === "QUEUED" || status === "PROCESSING";
  const pct = done ? 100 : Math.round(job?.progress?.pct ?? 0);
  const message = failed
    ? job?.error || "Something went wrong."
    : cancelled
      ? "Stopped. Clips already made are kept below."
      : (job?.progress?.message ?? "");

  return (
    <section className="border-t border-line pt-5" aria-label="Job progress">
      <div className="flex items-center justify-between gap-6">
        <ol className="flex flex-wrap gap-x-7 gap-y-2">
          {STAGES.map((label, i) => {
            const index = i + 1;
            const isDone = done || index < stage;
            const isActive = !done && index === stage && running;
            return (
              <li
                key={label}
                className={cn(
                  "relative pl-[18px] text-sm",
                  isDone ? "text-ink" : isActive ? "font-semibold text-accentink" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-[0.5em] h-2 w-2 rounded-full border-[1.5px]",
                    isDone
                      ? "border-ink bg-ink"
                      : isActive
                        ? "animate-pulse border-accent bg-accent"
                        : "border-muted",
                  )}
                  aria-hidden="true"
                />
                {label}
              </li>
            );
          })}
        </ol>
        <div
          className={cn(
            "font-display text-4xl font-extrabold tabular-nums leading-none",
            failed && "text-accentink",
          )}
          aria-hidden="true"
        >
          {pct}%
        </div>
      </div>
      <p
        className={cn(
          "mt-3 min-h-[1.4em] text-sm",
          failed ? "font-semibold text-accentink" : "text-muted",
        )}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </section>
  );
}
