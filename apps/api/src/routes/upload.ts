import path from "node:path";
import { Router } from "express";
import { ProbeResponseSchema } from "@clipdesk/types";
import { HttpError, asyncHandler, send } from "../lib/http";
import { logger } from "../lib/logger";
import { probeDuration, probeErrorMessage } from "../services/ffprobe.service";
import { uploadStorage } from "../services/storage.service";

export const uploadRouter = Router();

const VIDEO_EXT = new Set([".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi"]);

// Streams the request body to disk in chunks, then probes it with ffprobe.
uploadRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const header = req.header("x-filename") ?? "stream.mp4";
    let name = path.basename(header.replace(/\\/g, "/"));
    try {
      name = decodeURIComponent(name);
    } catch {
      /* keep the raw header */
    }
    name = path.basename(name) || "stream.mp4";
    if (!VIDEO_EXT.has(path.extname(name).toLowerCase())) {
      throw new HttpError(422, "That doesn't look like a video file (MP4, MKV, WebM, MOV).");
    }

    const rel = `${Date.now()}_${name}`;
    try {
      await uploadStorage.write(rel, req);
    } catch (err) {
      logger.error({ err }, "upload write failed");
      throw new HttpError(500, "Could not save the upload.");
    }

    const abs = uploadStorage.resolve(rel);
    let duration: number;
    try {
      duration = await probeDuration(abs);
    } catch (err) {
      logger.warn({ err, name }, "upload probe failed");
      await uploadStorage.delete(rel).catch(() => undefined);
      throw new HttpError(422, probeErrorMessage(err));
    }
    const size = (await uploadStorage.stat(rel)).size;
    send(res, ProbeResponseSchema, { path: abs, name, size, duration }, 201);
  }),
);
