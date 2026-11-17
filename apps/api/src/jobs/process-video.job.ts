import fs from "node:fs";
import path from "node:path";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { Prisma } from "@prisma/client";
import type { Settings } from "@clipdesk/types";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { resolveBriefJson } from "../services/brief.service";
import { generateHookVariants } from "../services/hook.service";
import { runPipeline } from "../services/pipeline.service";
import { generateThumbOptions } from "../services/thumb.service";

export const QUEUE_NAME = "video";

export const redisConnection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
export const videoQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

function normalizeSettings(raw: unknown): Settings {
  const value = (raw ?? {}) as Partial<Settings>;
  return {
    clips: typeof value.clips === "number" ? value.clips : 3,
    voice: value.voice !== false,
    music: value.music !== false,
    geminiKey: value.geminiKey,
    config: value.config ?? {},
  };
}

const GEMINI_MODEL = "gemini-2.5-flash-lite";

/** Generate hook alternatives and thumbnail candidates for finished clips. */
async function enrichClips(jobId: string, settings: Settings, game: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { clips: true } });
  if (!job) return;
  const waveform = (job.waveform as number[] | null) ?? null;
  for (const clip of job.clips) {
    const script = clip.scriptId
      ? await prisma.script.findUnique({ where: { id: clip.scriptId } })
      : null;
    const variants = await generateHookVariants(
      game,
      script
        ? { title: script.title, description: script.description, keywords: script.keywords }
        : null,
      clip.hook,
      settings.geminiKey,
      GEMINI_MODEL,
    );
    const thumb = await generateThumbOptions(clip, waveform, job.duration);
    await prisma.clip.update({
      where: { id: clip.id },
      data: {
        hookVariants: variants as unknown as Prisma.InputJsonValue,
        thumbOptions: thumb.options as unknown as Prisma.InputJsonValue,
        thumbPath: thumb.selectedPath || clip.thumbPath,
      },
    });
  }
}

export const videoWorker = new Worker(
  QUEUE_NAME,
  async (job: Job<{ jobId: string }>): Promise<void> => {
    const jobId = job.data.jobId;
    const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
    if (!dbJob) throw new Error(`Unknown job ${jobId}`);
    if (dbJob.status === "CANCELLED") return;

    const settings = normalizeSettings(dbJob.settings);
    const game = settings.config.gameName ?? "GTA 6";

    // Resolve the brief (if any) and hand it to the Python worker.
    let briefPath: string | null = null;
    const manualTimestamps = await prisma.manualTimestamp.findMany({ where: { jobId } });
    if (dbJob.briefId || manualTimestamps.length > 0) {
      const briefJson = await resolveBriefJson(
        dbJob.briefId,
        manualTimestamps.map((t) => ({ startSec: t.startSec, endSec: t.endSec, label: t.label ?? undefined })),
        game,
        dbJob.clipCount,
      );
      if (briefJson) {
        const jobDir = path.join(config.WORK_DIR, jobId);
        await fs.promises.mkdir(jobDir, { recursive: true });
        briefPath = path.join(jobDir, "brief.json");
        await fs.promises.writeFile(briefPath, JSON.stringify(briefJson, null, 2), "utf8");
      }
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "PROCESSING", progress: { stage: 1, pct: 0, message: "Starting" }, error: null },
    });

    const result = await runPipeline(jobId, dbJob.sourceFile, dbJob.clipCount, settings, briefPath);

    if (!result.ok && result.cancelled) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "CANCELLED", progress: { stage: 5, pct: 100, message: "Stopped" } },
      });
      logger.info({ jobId }, "job cancelled");
      return;
    }
    if (!result.ok) {
      await prisma.job.update({ where: { id: jobId }, data: { status: "FAILED", error: result.error } });
      throw new Error(result.error);
    }
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "COMPLETED", progress: { stage: 5, pct: 100, message: "Done" }, error: null },
    });
    await enrichClips(jobId, settings, game);
    logger.info({ jobId }, "job completed");
  },
  { connection: redisConnection, concurrency: 1 },
);
