"use client";

import { useCallback, useState } from "react";
import type { Clip } from "@clipdesk/types";
import { zipUrl } from "../lib/api";
import { useJobPolling } from "../hooks/use-job-polling";
import { ClipCard } from "./clip-card";
import { ClipModal } from "./clip-modal";
import { JobProgress } from "./job-progress";

export function JobPageClient({ jobId }: { jobId: string }) {
  const { job, setJob, error: pollError } = useJobPolling(jobId);
  const [selected, setSelected] = useState<Clip | null>(null);
  const clips = job?.clips ?? [];

  const updateClip = useCallback((updated: Clip) => {
    setJob((prev) =>
      prev ? { ...prev, clips: prev.clips.map((clip) => (clip.id === updated.id ? updated : clip)) } : prev,
    );
  }, [setJob]);

  const deleteClip = useCallback((clip: Clip) => {
    setJob((prev) => (prev ? { ...prev, clips: prev.clips.filter((c) => c.id !== clip.id) } : prev));
    setSelected(null);
  }, [setJob]);

  return (
    <div className="space-y-10 pt-4">
      <div>
        <h1 className="font-display text-4xl font-black uppercase leading-none text-ink">
          {job?.sourceName ?? "Run"}
        </h1>
        <p className="mt-2 text-sm text-muted">Run {jobId}</p>
      </div>

      <JobProgress job={job} />
      {pollError ? <p className="text-sm text-accentink">{pollError}</p> : null}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-display text-4xl font-extrabold uppercase text-ink">
            Shorts
            {clips.length ? <span className="ml-3 text-muted">{clips.length}</span> : null}
          </h2>
          {job && clips.length > 0 ? (
            <a
              href={zipUrl(job.id)}
              download
              className="text-sm font-semibold text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
            >
              Download all
            </a>
          ) : null}
        </div>
        {clips.length === 0 ? (
          <p className="text-muted">
            {job?.status === "FAILED"
              ? job.error || "This run failed."
              : "Clips will appear here as they finish."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onOpen={setSelected}
                onUpdate={updateClip}
                onDelete={deleteClip}
                onHover={() => undefined}
              />
            ))}
          </div>
        )}
      </section>

      <ClipModal
        clip={selected}
        onClose={() => setSelected(null)}
        onUpdate={updateClip}
        onDelete={deleteClip}
      />
    </div>
  );
}
