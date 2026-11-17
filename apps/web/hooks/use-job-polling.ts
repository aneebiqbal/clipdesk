"use client";

import { useEffect, useState } from "react";
import type { Job } from "@clipdesk/types";
import { api } from "../lib/api";

/** Poll a job every `intervalMs` until it leaves QUEUED/PROCESSING. */
export function useJobPolling(jobId: string | null, intervalMs = 1500) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJob(null);
    setError(null);
    if (!jobId) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const next = await api.getJob(jobId);
        if (stopped) return;
        setJob(next);
        setError(null);
        if (next.status === "QUEUED" || next.status === "PROCESSING") {
          timer = setTimeout(tick, intervalMs);
        }
      } catch (err) {
        if (stopped) return;
        setError(err instanceof Error ? err.message : String(err));
        timer = setTimeout(tick, intervalMs);
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, intervalMs]);

  return { job, setJob, error };
}
