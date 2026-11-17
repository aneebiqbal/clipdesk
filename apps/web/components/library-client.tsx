"use client";

import { useCallback, useEffect, useState } from "react";
import type { Clip, LibraryRun } from "@clipdesk/types";
import { api, zipUrl } from "../lib/api";
import { date, long } from "../lib/format";
import { cn } from "../lib/utils";
import { ClipCard } from "./clip-card";
import { ClipModal } from "./clip-modal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

export function LibraryClient() {
  const toast = useToast();
  const [runs, setRuns] = useState<LibraryRun[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clipsByRun, setClipsByRun] = useState<Record<string, Clip[]>>({});
  const [selected, setSelected] = useState<Clip | null>(null);
  const [confirmRun, setConfirmRun] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .library()
      .then(setRuns)
      .catch((err: unknown) => toast(err instanceof Error ? err.message : String(err)));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (run: LibraryRun) => {
    if (expanded === run.id) {
      setExpanded(null);
      return;
    }
    setExpanded(run.id);
    if (!clipsByRun[run.id]) {
      try {
        const detail = await api.libraryRun(run.id);
        setClipsByRun((prev) => ({ ...prev, [run.id]: detail.clips }));
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const updateClip = useCallback((updated: Clip) => {
    setClipsByRun((prev) => ({
      ...prev,
      [updated.jobId]: (prev[updated.jobId] ?? []).map((clip) =>
        clip.id === updated.id ? updated : clip,
      ),
    }));
  }, []);

  const deleteClip = useCallback((clip: Clip) => {
    setClipsByRun((prev) => ({
      ...prev,
      [clip.jobId]: (prev[clip.jobId] ?? []).filter((c) => c.id !== clip.id),
    }));
    setRuns((prev) =>
      prev
        ? prev.map((run) =>
            run.id === clip.jobId ? { ...run, clipCount: Math.max(0, run.clipCount - 1) } : run,
          )
        : prev,
    );
    setSelected(null);
  }, []);

  const deleteRun = async (runId: string) => {
    if (confirmRun !== runId) {
      setConfirmRun(runId);
      return;
    }
    setConfirmRun(null);
    try {
      await api.deleteRun(runId);
      setRuns((prev) => (prev ? prev.filter((run) => run.id !== runId) : prev));
      setExpanded((prev) => (prev === runId ? null : prev));
      toast("Run deleted.");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-8 pt-4">
      <div>
        <h1 className="font-display text-4xl font-black uppercase leading-none text-ink">Library</h1>
        <p className="mt-2 text-sm text-muted">Earlier runs and the clips they produced.</p>
      </div>

      {runs === null ? (
        <p className="text-muted">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-muted">No finished runs yet.</p>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const clips = clipsByRun[run.id] ?? [];
            const isOpen = expanded === run.id;
            return (
              <div key={run.id} className="rounded-lg border border-line bg-panel">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void toggle(run)}
                    aria-expanded={isOpen}
                  >
                    <span className="block truncate font-semibold text-ink">{run.sourceName}</span>
                    <span className="mt-0.5 block text-xs tabular-nums text-muted">
                      {run.clipCount} {run.clipCount === 1 ? "clip" : "clips"}
                      {run.duration ? `, ${long(run.duration)}` : ""}, {date(run.createdAt)}
                    </span>
                  </button>
                  <Badge
                    className={cn(
                      run.status === "COMPLETED" && "border-accent/40 text-accent",
                      run.status === "FAILED" && "border-accentink/50 text-accentink",
                    )}
                  >
                    {run.status}
                  </Badge>
                  <div className="flex gap-2">
                    <a
                      href={zipUrl(run.id)}
                      download
                      className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink transition-colors hover:bg-white/5"
                    >
                      Zip
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void deleteRun(run.id)}
                      className={cn(confirmRun === run.id && "border-accentink text-accentink")}
                    >
                      {confirmRun === run.id ? "Confirm delete" : "Delete"}
                    </Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="border-t border-line px-4 py-4">
                    {clips.length === 0 ? (
                      <p className="text-sm text-muted">Loading clips…</p>
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
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <ClipModal
        clip={selected}
        onClose={() => setSelected(null)}
        onUpdate={updateClip}
        onDelete={deleteClip}
      />
    </div>
  );
}
