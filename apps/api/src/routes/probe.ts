import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { Router } from "express";
import { ProbeResponseSchema } from "@clipdesk/types";
import { HttpError, asyncHandler, parseBody, send } from "../lib/http";
import { logger } from "../lib/logger";
import { probeDuration, probeErrorMessage } from "../services/ffprobe.service";

export const probeRouter = Router();

const ProbeSchema = z.object({ path: z.string().min(1) });
const VIDEO_EXT = new Set([".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi"]);

function expandPath(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed.startsWith("~") ? path.join(os.homedir(), trimmed.slice(1)) : trimmed;
}

probeRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(ProbeSchema, req.body);
    const abs = path.resolve(expandPath(body.path));
    if (!fs.existsSync(abs)) {
      throw new HttpError(404, "No file at that path. Check the spelling, or drag the file into the window.");
    }
    if (!fs.statSync(abs).isFile() || !VIDEO_EXT.has(path.extname(abs).toLowerCase())) {
      throw new HttpError(422, "That doesn't look like a video file (MP4, MKV, WebM, MOV).");
    }
    let duration: number;
    try {
      duration = await probeDuration(abs);
    } catch (err) {
      logger.warn({ err, path: abs }, "path probe failed");
      throw new HttpError(422, probeErrorMessage(err));
    }
    send(res, ProbeResponseSchema, {
      path: abs,
      name: path.basename(abs),
      size: fs.statSync(abs).size,
      duration,
    });
  }),
);
