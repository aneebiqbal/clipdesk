import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import { Router } from "express";
import {
  ClipSchema,
  LibraryResponseSchema,
  LibraryRunDetailSchema,
  OkResponseSchema,
  UpdateClipSchema,
} from "@clipdesk/types";
import { HttpError, asyncHandler, parseBody, send } from "../lib/http";
import { logger } from "../lib/logger";
import { serializeClip, serializeClips } from "../lib/serialize";
import { prisma } from "../lib/prisma";
import { storage } from "../services/storage.service";

export const libraryRouter = Router();

libraryRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.job.findMany({
      where: { clips: { some: {} } },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { clips: true } } },
    });
    send(
      res,
      LibraryResponseSchema,
      rows.map((job) => ({
        id: job.id,
        status: job.status,
        sourceName: job.sourceName,
        duration: job.duration,
        clipCount: job._count.clips,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
    );
  }),
);

libraryRouter.get(
  "/:run",
  asyncHandler(async (req, res) => {
    const run = req.params.run;
    if (!run) throw new HttpError(404, "Unknown run.");
    const job = await prisma.job.findUnique({ where: { id: run }, include: { clips: true } });
    if (!job) throw new HttpError(404, "That run no longer exists.");
    send(res, LibraryRunDetailSchema, { run: job.id, clips: serializeClips(job.clips) });
  }),
);

libraryRouter.get(
  "/:run/zip",
  asyncHandler(async (req, res) => {
    const run = req.params.run;
    if (!run) throw new HttpError(404, "Unknown run.");
    const job = await prisma.job.findUnique({ where: { id: run }, include: { clips: true } });
    if (!job || job.clips.length === 0) throw new HttpError(404, "That run no longer exists.");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      logger.error({ err }, "zip failed");
      if (!res.headersSent) res.status(500).json({ error: "Could not build the zip." });
    });
    res.attachment(`${run}.zip`);
    archive.pipe(res);
    for (const clip of job.clips) {
      const abs = storage.resolve(clip.filePath);
      if (fs.existsSync(abs)) archive.file(abs, { name: path.basename(clip.filePath) });
    }
    await archive.finalize();
  }),
);

libraryRouter.patch(
  "/:run/:clip",
  asyncHandler(async (req, res) => {
    const run = req.params.run;
    const clipId = req.params.clip;
    if (!run || !clipId) throw new HttpError(404, "Unknown clip.");
    const body = parseBody(UpdateClipSchema, req.body);
    const clip = await prisma.clip.findFirst({ where: { jobId: run, id: clipId } });
    if (!clip) throw new HttpError(404, "Clip not found.");
    const updated = await prisma.clip.update({
      where: { id: clip.id },
      data: {
        title: body.title ?? clip.title,
        description: body.description ?? clip.description,
        hook: body.hook === undefined ? clip.hook : body.hook,
        outro: body.outro === undefined ? clip.outro : body.outro,
        thumbPath: body.thumbPath === undefined ? clip.thumbPath : body.thumbPath,
      },
    });
    send(res, ClipSchema, serializeClip(updated));
  }),
);

libraryRouter.delete(
  "/:run/:clip",
  asyncHandler(async (req, res) => {
    const run = req.params.run;
    const clipId = req.params.clip;
    if (!run || !clipId) throw new HttpError(404, "Unknown clip.");
    const clip = await prisma.clip.findFirst({ where: { jobId: run, id: clipId } });
    if (!clip) throw new HttpError(404, "Clip not found.");
    await prisma.clip.delete({ where: { id: clip.id } });
    await storage.delete(clip.filePath).catch(() => undefined);
    if (clip.thumbPath) await storage.delete(clip.thumbPath).catch(() => undefined);
    send(res, OkResponseSchema, { ok: true });
  }),
);

libraryRouter.delete(
  "/:run",
  asyncHandler(async (req, res) => {
    const run = req.params.run;
    if (!run) throw new HttpError(404, "Unknown run.");
    const job = await prisma.job.findUnique({ where: { id: run }, include: { clips: true } });
    if (!job) throw new HttpError(404, "Unknown run.");
    for (const clip of job.clips) {
      await storage.delete(clip.filePath).catch(() => undefined);
      if (clip.thumbPath) await storage.delete(clip.thumbPath).catch(() => undefined);
    }
    await prisma.job.delete({ where: { id: run } });
    await storage.removeDir(job.runName ?? run).catch(() => undefined);
    send(res, OkResponseSchema, { ok: true });
  }),
);
