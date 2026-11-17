import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import {
  CreateJobResponseSchema,
  CreateJobSchema,
  JobSchema,
  OkResponseSchema,
  type CreateJob,
} from "@clipdesk/types";
import { videoQueue } from "../jobs/process-video.job";
import { HttpError, asyncHandler, parseBody, send } from "../lib/http";
import { serializeJob } from "../lib/serialize";
import { prisma } from "../lib/prisma";
import { requestCancel } from "../services/pipeline.service";
import { getSettings, updateSettings } from "../services/settings.service";

export const jobsRouter = Router();

const VIDEO_EXT = new Set([".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi"]);

async function resolveSettings(body: CreateJob) {
  const current = await getSettings();
  if (body.clips === undefined && body.voice === undefined && body.music === undefined) {
    return current;
  }
  return updateSettings({ clips: body.clips, voice: body.voice, music: body.music });
}

jobsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(CreateJobSchema, req.body);
    const abs = path.resolve(body.path);
    if (!fs.existsSync(abs)) {
      throw new HttpError(404, "The video file is missing. Choose it again.");
    }
    if (!fs.statSync(abs).isFile() || !VIDEO_EXT.has(path.extname(abs).toLowerCase())) {
      throw new HttpError(422, "That doesn't look like a video file (MP4, MKV, WebM, MOV).");
    }
    const settings = await resolveSettings(body);
    if (body.briefId) {
      const brief = await prisma.brief.findUnique({ where: { id: body.briefId } });
      if (!brief) throw new HttpError(404, "Unknown brief.");
    }
    const job = await prisma.job.create({
      data: {
        sourceFile: abs,
        sourceName: body.name ?? path.basename(abs),
        clipCount: settings.clips,
        settings: settings as unknown as Prisma.InputJsonValue,
        status: "QUEUED",
        briefId: body.briefId ?? null,
        manualTimestamps: body.manualTimestamps?.length
          ? {
              create: body.manualTimestamps.map((timestamp) => ({
                startSec: timestamp.startSec,
                endSec: timestamp.endSec,
                label: timestamp.label ?? null,
              })),
            }
          : undefined,
      },
      include: { clips: true },
    });
    await videoQueue.add("process", { jobId: job.id }, { jobId: job.id, attempts: 1 });
    send(res, CreateJobResponseSchema, { id: job.id }, 201);
  }),
);

jobsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown run.");
    const job = await prisma.job.findUnique({ where: { id }, include: { clips: true } });
    if (!job) throw new HttpError(404, "Unknown run.");
    send(res, JobSchema, serializeJob(job));
  }),
);

jobsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown run.");
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) throw new HttpError(404, "Unknown run.");
    if (job.status === "QUEUED") {
      await prisma.job.update({
        where: { id },
        data: { status: "CANCELLED", progress: { stage: 5, pct: 100, message: "Cancelled" } },
      });
      const queued = await videoQueue.getJob(id);
      await queued?.remove();
    } else if (job.status === "PROCESSING") {
      requestCancel(id);
    }
    send(res, OkResponseSchema, { ok: true });
  }),
);
