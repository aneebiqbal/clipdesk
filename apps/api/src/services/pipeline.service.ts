import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { WorkerClipMetaSchema, type Settings, type WorkerClipMeta } from "@clipdesk/types";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { buildWorkerConfig } from "./worker-config";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const WORKER_DIR = path.join(REPO_ROOT, "worker");

interface ActiveRun {
  proc: ChildProcessWithoutNullStreams;
  cancelFile: string;
}

const active: Map<string, ActiveRun> = new Map();

export type PipelineResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error: string };

/** Ask a running pipeline to stop at its next checkpoint. */
export function requestCancel(jobId: string): void {
  const run = active.get(jobId);
  if (!run) return;
  try {
    fs.writeFileSync(run.cancelFile, "");
  } catch (err) {
    logger.warn({ err, jobId }, "could not write cancel file");
  }
  // FFmpeg calls can outlive the checkpoints; do not wait forever.
  setTimeout(() => {
    try {
      run.proc.kill("SIGTERM");
    } catch {
      /* process already gone */
    }
  }, 20_000).unref();
}

async function upsertClip(jobId: string, meta: WorkerClipMeta): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { runName: true },
  });
  const runName = job?.runName ?? jobId;
  const id = `${jobId}:${meta.file}`;
  const data = {
    jobId,
    filePath: `${runName}/${meta.file}`,
    thumbPath: meta.thumb ? `${runName}/${meta.thumb}` : null,
    title: meta.title,
    description: meta.description,
    hook: meta.hook,
    outro: meta.outro,
    sourceStart: meta.source_start,
    sourceEnd: meta.source_end,
    duration: meta.duration,
    score: meta.score,
    musicTrack: meta.music,
    topicId: meta.topic_id ?? null,
    scriptId: meta.script_id ?? null,
    matchScore: meta.match_score ?? null,
    matchMethod: meta.match_method ?? null,
    seriesGroup: meta.series_group ?? null,
    seriesPart: meta.series_part ?? null,
  };
  await prisma.clip.upsert({ where: { id }, create: data, update: data });
}

/**
 * Run the Python pipeline for a job, mirroring its JSON-line events into Postgres.
 * The heavy lifting (Whisper, FFmpeg, TTS) stays in the worker process.
 */
export async function runPipeline(
  jobId: string,
  input: string,
  clips: number,
  settings: Settings,
  briefPath: string | null = null,
): Promise<PipelineResult> {
  const jobDir = path.join(config.WORK_DIR, jobId);
  await fs.promises.mkdir(jobDir, { recursive: true });
  const cfgPath = path.join(jobDir, "config.yaml");
  await fs.promises.writeFile(cfgPath, yaml.stringify(buildWorkerConfig(settings)), "utf8");
  const cancelFile = path.join(jobDir, "cancel");
  const script = path.join(WORKER_DIR, "run_json.py");
  const args = [
    script,
    "--input",
    input,
    "--clips",
    String(clips),
    "--config",
    cfgPath,
    "--output",
    config.OUTPUT_DIR,
    "--cancel-file",
    cancelFile,
  ];
  if (briefPath) args.push("--brief", briefPath);

  logger.info({ jobId, input, clips }, "starting python pipeline");
  const proc = spawn(config.PYTHON_PATH, args, {
    cwd: WORKER_DIR,
    env: {
      ...process.env,
      GEMINI_API_KEY: settings.geminiKey ?? process.env.GEMINI_API_KEY ?? "",
    },
  });
  active.set(jobId, { proc, cancelFile });

  let stderr = "";
  let failure: Error | null = null;
  let cancelledFlag = false;
  const pendingClips: Promise<void>[] = [];

  const update = async (data: Parameters<typeof prisma.job.update>[0]): Promise<void> => {
    try {
      await prisma.job.update(data);
    } catch (err) {
      logger.error({ err, jobId }, "job update failed");
    }
  };

  let eventChain: Promise<void> = Promise.resolve();

  const handleLine = async (line: string): Promise<void> => {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      logger.debug({ jobId, line }, "python stdout");
      return;
    }
    const kind = (event as { kind?: unknown }).kind;
    switch (kind) {
      case "run":
        await update({ where: { id: jobId }, data: { runName: String((event as { name?: unknown }).name ?? "") } });
        break;
      case "duration":
        await update({ where: { id: jobId }, data: { duration: Number((event as { seconds?: unknown }).seconds) } });
        break;
      case "progress": {
        const e = event as { stage?: unknown; pct?: unknown; message?: unknown; frac?: unknown };
        if (typeof e.stage === "number" && typeof e.pct === "number" && typeof e.message === "string") {
          const frac = typeof e.frac === "number" ? e.frac : undefined;
          await update({
            where: { id: jobId },
            data: {
              progress: {
                stage: e.stage,
                pct: e.pct,
                message: e.message,
                ...(frac !== undefined ? { frac } : {}),
              },
            },
          });
        }
        break;
      }
      case "waveform": {
        const values = (event as { values?: unknown }).values;
        if (Array.isArray(values)) await update({ where: { id: jobId }, data: { waveform: values } });
        break;
      }
      case "moments": {
        const e = event as { candidates?: unknown; selected?: unknown };
        if (Array.isArray(e.candidates) && Array.isArray(e.selected)) {
          try {
            const job = await prisma.job.findUnique({ where: { id: jobId }, select: { moments: true } });
            const current = (job?.moments as Record<string, unknown> | null) ?? {};
            await update({
              where: { id: jobId },
              data: { moments: { ...current, candidates: e.candidates, selected: e.selected } },
            });
          } catch (err) {
            logger.error({ err, jobId }, "moments update failed");
          }
        }
        break;
      }
      case "clip": {
        const parsed = WorkerClipMetaSchema.safeParse((event as { meta?: unknown }).meta);
        if (parsed.success) {
          pendingClips.push(
            upsertClip(jobId, parsed.data).catch((err) => {
              logger.error({ err, jobId }, "clip upsert failed");
            }),
          );
        } else {
          logger.warn({ jobId, meta: (event as { meta?: unknown }).meta }, "bad clip event");
        }
        break;
      }
      case "topics": {
        const topics = (event as { topics?: unknown }).topics;
        if (Array.isArray(topics)) {
          try {
            const job = await prisma.job.findUnique({ where: { id: jobId }, select: { moments: true } });
            const current = (job?.moments as Record<string, unknown> | null) ?? {};
            await prisma.job.update({
              where: { id: jobId },
              data: { moments: { ...current, topics } },
            });
          } catch (err) {
            logger.error({ err, jobId }, "topics update failed");
          }
        }
        break;
      }
      case "log":
        logger.info({ jobId }, String((event as { message?: unknown }).message ?? ""));
        break;
      case "result":
        logger.info({ jobId, run: (event as { run?: unknown }).run }, "pipeline finished");
        break;
      case "cancelled":
        cancelledFlag = true;
        break;
      case "error":
        failure = new Error(String((event as { message?: unknown }).message ?? "Python pipeline failed"));
        break;
      default:
        logger.debug({ jobId, event }, "unknown pipeline event");
    }
  };

  let buffer = "";
  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) {
        eventChain = eventChain
          .then(() => handleLine(line))
          .catch((err) => logger.error({ err, jobId }, "event handling failed"));
      }
      index = buffer.indexOf("\n");
    }
  });
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-2000);
  });
  proc.on("error", (err) => {
    failure = err;
  });

  const code = await new Promise<number | null>((resolve) => {
    let settled = false;
    const finish = (value: number | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    proc.on("close", finish);
    proc.on("error", () => finish(null));
  });
  active.delete(jobId);
  await eventChain;
  await Promise.allSettled(pendingClips);

  const cancelled = cancelledFlag || fs.existsSync(cancelFile);
  if (cancelled) return { ok: false, cancelled: true, error: "Cancelled" };
  const finalFailure = failure as Error | null;
  if (finalFailure) return { ok: false, cancelled: false, error: finalFailure.message.slice(-900) };
  if (code !== 0) {
    return {
      ok: false,
      cancelled: false,
      error: (stderr.trim() || `Python exited with code ${code}`).slice(-900),
    };
  }
  return { ok: true };
}
