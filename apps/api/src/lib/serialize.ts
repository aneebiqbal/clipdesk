import type { Clip as ClipRow, Job as JobRow, Settings as SettingsRow } from "@prisma/client";
import type {
  Clip,
  HookVariant,
  Job,
  JobStatus,
  Moments,
  SettingsConfig,
  SettingsResponse,
  ThumbOption,
} from "@clipdesk/types";

export function serializeClip(clip: ClipRow): Clip {
  return {
    id: clip.id,
    jobId: clip.jobId,
    filePath: clip.filePath,
    thumbPath: clip.thumbPath,
    title: clip.title,
    description: clip.description,
    hook: clip.hook,
    outro: clip.outro,
    sourceStart: clip.sourceStart,
    sourceEnd: clip.sourceEnd,
    duration: clip.duration,
    score: clip.score,
    musicTrack: clip.musicTrack,
    createdAt: clip.createdAt.toISOString(),
    topicId: clip.topicId,
    scriptId: clip.scriptId,
    matchScore: clip.matchScore,
    matchMethod: clip.matchMethod,
    seriesGroup: clip.seriesGroup,
    seriesPart: clip.seriesPart,
    hookVariants: (clip.hookVariants as HookVariant[] | null) ?? null,
    thumbOptions: (clip.thumbOptions as ThumbOption[] | null) ?? null,
  };
}

export function serializeClips(clips: ClipRow[]): Clip[] {
  return clips
    .map(serializeClip)
    .sort((a, b) => a.sourceStart - b.sourceStart);
}

export function serializeJob(job: JobRow & { clips?: ClipRow[] }): Job {
  return {
    id: job.id,
    status: job.status as JobStatus,
    sourceFile: job.sourceFile,
    sourceName: job.sourceName,
    duration: job.duration,
    clipCount: job.clipCount,
    briefId: job.briefId,
    settings: (job.settings ?? {}) as Record<string, unknown>,
    progress:
      (job.progress as { stage: number; pct: number; message: string; frac?: number } | null) ?? null,
    waveform: (job.waveform as number[] | null) ?? null,
    moments: (job.moments as unknown as Moments | null) ?? null,
    clips: serializeClips(job.clips ?? []),
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

type SettingsLike = {
  clips: number;
  voice: boolean;
  music: boolean;
  geminiKey?: string | null;
  config: unknown;
};

export function serializeSettings(settings: SettingsLike): SettingsResponse {
  return {
    clips: settings.clips,
    voice: settings.voice,
    music: settings.music,
    geminiKeySet: Boolean(settings.geminiKey),
    config: (settings.config ?? {}) as SettingsConfig,
  };
}

export type { SettingsRow };
