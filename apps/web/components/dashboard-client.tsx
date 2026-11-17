"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Clip, ProbeResponse } from "@clipdesk/types";
import { api, uploadFile, zipUrl } from "../lib/api";
import { useBrief } from "../hooks/use-brief";
import { useJobPolling } from "../hooks/use-job-polling";
import { useSettings } from "../hooks/use-settings";
import { BriefBuilder } from "./brief-builder";
import { ClipCard } from "./clip-card";
import { ClipModal } from "./clip-modal";
import { JobProgress } from "./job-progress";
import { SettingsDrawer } from "./settings-panel";
import { UploadZone } from "./upload-zone";
import { WaveformTimeline } from "./waveform-timeline";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { useToast } from "./ui/toast";

type GalleryGroup = { topicId: string; name: string; clips: Clip[] };

export function DashboardClient() {
  const toast = useToast();
  const { form: settings, patch, activeJobId } = useSettings();
  const brief = useBrief();
  const [file, setFile] = useState<ProbeResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const { job, setJob, error: pollError } = useJobPolling(jobId);
  const [focusStart, setFocusStart] = useState<number | null>(null);
  const [selected, setSelected] = useState<Clip | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (activeJobId) setJobId(activeJobId);
  }, [activeJobId]);

  const running = job?.status === "QUEUED" || job?.status === "PROCESSING";
  const clips = useMemo(() => job?.clips ?? [], [job?.clips]);
  const clipsValue = settings?.clips ?? 3;

  const handleFile = useCallback(
    async (next: File) => {
      if (!(next.type.startsWith("video/") || /\.(mkv|mp4|webm|mov|m4v|avi)$/i.test(next.name))) {
        toast("That is not a video file. Choose an MP4, MKV or WebM.");
        return;
      }
      setUploading(true);
      setUploadPct(0);
      try {
        setFile(await uploadFile(next, setUploadPct));
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [toast],
  );

  const handlePath = useCallback(
    async (path: string) => {
      try {
        setFile(await api.probe(path));
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [toast],
  );

  const start = useCallback(async () => {
    if (!file || !settings) return;
    try {
      let briefId = brief.briefId;
      if (!briefId && brief.topics.length > 0) briefId = await brief.saveNow();
      const created = await api.createJob({
        path: file.path,
        name: file.name,
        clips: settings.clips,
        voice: settings.voice,
        music: settings.music,
        briefId: briefId ?? undefined,
        manualTimestamps: brief.timestamps,
      });
      setFocusStart(null);
      setJob(null);
      setJobId(created.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  }, [file, settings, brief, toast, setJob]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    try {
      await api.cancelJob(jobId);
      toast("Stopping after the current step.");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  }, [jobId, toast]);

  const updateClip = useCallback((updated: Clip) => {
    setJob((prev) =>
      prev ? { ...prev, clips: prev.clips.map((clip) => (clip.id === updated.id ? updated : clip)) } : prev,
    );
  }, [setJob]);

  const deleteClip = useCallback((clip: Clip) => {
    setJob((prev) => (prev ? { ...prev, clips: prev.clips.filter((c) => c.id !== clip.id) } : prev));
    setSelected(null);
  }, [setJob]);

  const groups = useMemo<GalleryGroup[]>(() => {
    if (clips.length === 0) return [];
    const tagged = clips.filter((clip) => clip.topicId);
    if (tagged.length === 0) return [];
    const meta = new Map((job?.moments?.topics ?? []).map((topic) => [topic.topicId, topic]));
    const byTopic = new Map<string, Clip[]>();
    for (const clip of tagged) {
      const key = clip.topicId ?? "";
      const list = byTopic.get(key) ?? [];
      list.push(clip);
      byTopic.set(key, list);
    }
    const result: GalleryGroup[] = [...byTopic.entries()].map(([topicId, items]) => ({
      topicId,
      name: meta.get(topicId)?.topicName ?? topicId,
      clips: items,
    }));
    const untagged = clips.filter((clip) => !clip.topicId);
    if (untagged.length > 0) result.push({ topicId: "", name: "Other", clips: untagged });
    return result;
  }, [clips, job?.moments?.topics]);

  const seriesTotals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const clip of clips) {
      if (clip.seriesGroup) counts.set(clip.seriesGroup, (counts.get(clip.seriesGroup) ?? 0) + 1);
    }
    return counts;
  }, [clips]);

  const seriesClips = useMemo(() => {
    if (!selected?.seriesGroup) return [];
    return clips.filter((clip) => clip.seriesGroup === selected.seriesGroup);
  }, [clips, selected]);

  const progress = job?.progress ?? null;
  const scannedPct =
    progress && progress.stage === 2 && progress.frac != null ? Math.round(progress.frac * 100) : null;

  const renderCard = (clip: Clip) => (
    <ClipCard
      key={clip.id}
      clip={clip}
      seriesTotal={clip.seriesGroup ? seriesTotals.get(clip.seriesGroup) : undefined}
      onOpen={setSelected}
      onUpdate={updateClip}
      onDelete={deleteClip}
      onHover={setFocusStart}
    />
  );

  return (
    <div className="space-y-10">
      <section className="pt-4">
        <h1 className="font-display text-5xl font-black uppercase leading-[0.85] text-ink sm:text-7xl">
          Long streams in.
          <br />
          Shorts out.
        </h1>
        <p className="mt-5 max-w-xl text-muted">
          Drop in a stream you downloaded from YouTube Studio. Clipdesk finds the best moments, cuts
          them to vertical, then adds captions, a short voice line and music.
        </p>
      </section>

      <UploadZone
        file={file}
        uploading={uploading}
        uploadPct={uploadPct}
        disabled={running}
        onFile={(next) => void handleFile(next)}
        onPath={(path) => void handlePath(path)}
      >
        <WaveformTimeline
          duration={job?.duration ?? file?.duration ?? null}
          waveform={job?.waveform ?? null}
          moments={job?.moments ?? null}
          focusStart={focusStart}
          scannedPct={scannedPct}
        />
      </UploadZone>

      <BriefBuilder brief={brief} disabled={running} duration={job?.duration ?? file?.duration ?? null} />

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Clips</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Fewer clips"
            disabled={!settings}
            onClick={() => patch({ clips: Math.max(1, clipsValue - 1) })}
          >
            −
          </Button>
          <span className="min-w-[2ch] text-center font-display text-3xl font-extrabold tabular-nums">
            {clipsValue}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="More clips"
            disabled={!settings}
            onClick={() => patch({ clips: Math.min(10, clipsValue + 1) })}
          >
            +
          </Button>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <Switch
            checked={settings?.voice ?? true}
            onCheckedChange={(next) => patch({ voice: next })}
            disabled={!settings}
            aria-label="Voice line"
          />
          Voice line
        </label>
        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <Switch
            checked={settings?.music ?? true}
            onCheckedChange={(next) => patch({ music: next })}
            disabled={!settings}
            aria-label="Music"
          />
          Music
        </label>

        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          {running ? (
            <Button type="button" variant="stop" onClick={() => void cancel()}>
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              variant="accent"
              onClick={() => void start()}
              disabled={!file || !settings}
            >
              Make Shorts
            </Button>
          )}
        </div>
      </div>

      {job ? <JobProgress job={job} /> : null}
      {pollError ? <p className="text-sm text-accentink">{pollError}</p> : null}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-display text-4xl font-extrabold uppercase text-ink">
            Your Shorts
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
          <p className="text-muted">Your clips show up here one by one as they finish.</p>
        ) : groups.length > 0 ? (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.topicId || "other"}>
                <h3 className="mb-3 text-lg font-semibold text-ink">
                  {group.name}
                  <span className="ml-2 text-sm font-normal text-muted">{group.clips.length}</span>
                </h3>
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {group.clips.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {clips.map(renderCard)}
          </div>
        )}
      </section>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        value={settings}
        onPatch={patch}
      />
      <ClipModal
        clip={selected}
        moments={job?.moments ?? null}
        seriesClips={seriesClips}
        onClose={() => setSelected(null)}
        onUpdate={updateClip}
        onDelete={deleteClip}
        onNavigate={setSelected}
      />
    </div>
  );
}
